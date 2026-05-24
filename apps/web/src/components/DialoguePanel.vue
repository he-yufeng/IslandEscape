<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useGameStore, CHARACTER_META } from '@/stores/game'
import type { CharacterId, NegotiationMessage, TradeProposal } from '@game/shared'
import { GAME_CONFIG } from '@game/shared'

const props = defineProps<{
  target: CharacterId
}>()

const emit = defineEmits<{
  close: []
}>()

const game = useGameStore()

const freeFormMessage = ref('')
const chatContainer = ref<HTMLElement | null>(null)

// Template trade builder
const templateAction = ref<'buy' | 'sell'>('buy')
const templateResource = ref<'fish' | 'wheat'>('fish')
const templateAmount = ref(3)
const templatePrice = ref(10)

const targetMeta = computed(() => CHARACTER_META[props.target] ?? { name: props.target, emoji: '?', personality: '' })

// Friendship display
const friendship = computed(() => game.getFriendship(props.target))
const friendshipHearts = computed(() => {
  const f = friendship.value
  // 0-4: empty, 5-14: 1 heart, 15-24: 2 hearts, 25-34: 3 hearts, 35+: 4 hearts
  if (f >= 35) return { filled: 4, empty: 0, label: 'Best Friends' }
  if (f >= 25) return { filled: 3, empty: 1, label: 'Good Friends' }
  if (f >= 15) return { filled: 2, empty: 2, label: 'Friendly' }
  if (f >= 5)  return { filled: 1, empty: 3, label: 'Acquaintance' }
  return { filled: 0, empty: 4, label: 'Stranger' }
})
const friendshipColor = computed(() => {
  const f = friendship.value
  if (f >= 35) return '#ff6b9d'
  if (f >= 25) return '#ff8fab'
  if (f >= 15) return '#ffb3c6'
  if (f >= 5)  return '#ffd6e0'
  return '#8a8a9a'
})

const messages = computed(() => game.activeNegotiation?.messages ?? [])
const messageCount = computed(() => messages.value.length)
const maxExchanges = GAME_CONFIG.MAX_NEGOTIATION_EXCHANGES
const showThinking = computed(() => game.negotiationPending === props.target)

const canSend = computed(() => {
  return messageCount.value < maxExchanges * 2 && !game.isLoading
})

/**
 * The latest NPC counter-offer that the player can act on.
 * Excludes NPC's own accept (which already executed a trade) and reject.
 */
const acceptableNpcProposal = computed(() => {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const m = messages.value[i]
    if (!m) continue
    if (m.speaker === 'player') continue       // player's own proposals don't count
    if (!m.proposal) continue                  // text-only NPC reply
    if (m.accept === true) return null         // NPC already accepted — handled by server
    return m
  }
  return null
})

const canAccept = computed(() => acceptableNpcProposal.value !== null && !game.isLoading)

// Auto-scroll on new messages or when thinking indicator appears
watch(
  [messages, showThinking],
  async () => {
    await nextTick()
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  },
  { deep: true },
)

function buildTemplateProposal(): { text: string; proposal: TradeProposal } {
  const action = templateAction.value
  const resource = templateResource.value
  const amount = templateAmount.value
  const price = templatePrice.value

  const text = action === 'buy'
    ? `I'd like to buy ${amount} ${resource} from you for ${price} coins`
    : `I'll sell you ${amount} ${resource} for ${price} coins`

  // Buy = player gives coins, gets resource. Sell = player gives resource, gets coins.
  const offer = { fish: 0, wheat: 0, coins: 0 }
  const request = { fish: 0, wheat: 0, coins: 0 }
  if (action === 'buy') {
    offer.coins = price
    request[resource] = amount
  } else {
    offer[resource] = amount
    request.coins = price
  }

  const proposal: TradeProposal = {
    from: 'player',
    to: props.target,
    offer,
    request,
  }
  return { text, proposal }
}

async function sendTemplate() {
  if (!canSend.value) return
  const { text, proposal } = buildTemplateProposal()
  await sendMessage(text, proposal)
}

async function sendFreeForm() {
  const trimmed = freeFormMessage.value.trim()
  if (!trimmed || !canSend.value) return
  await sendMessage(trimmed)
  freeFormMessage.value = ''
}

async function sendMessage(message: string, proposal?: TradeProposal) {
  if (!game.activeNegotiation) return

  // First message of a new negotiation → initiate trade via trade_peer action
  if (game.activeNegotiation.isNew) {
    await game.submitAction({
      type: 'trade_peer',
      target: game.activeNegotiation.target,
      message,
      ...(proposal ? { proposal } : {}),
    })
  } else {
    // Subsequent messages or resumed conversation → negotiate_reply
    await game.submitAction({
      type: 'negotiate_reply',
      conversationId: game.activeNegotiation.conversationId,
      message,
      ...(proposal ? { proposal } : {}),
    })
  }
}

function validateProposal(proposal: TradeProposal): string | null {
  const fromChar = game.state?.characters[proposal.from]
  const toChar = game.state?.characters[proposal.to]
  if (!fromChar || !toChar) return 'Character not found.'

  const fromResources = fromChar.resources
  const toResources = toChar.resources
  const o = proposal.offer
  const r = proposal.request

  // Check from has enough to give
  if (fromResources.fish < o.fish) return `${proposal.from} doesn't have enough fish (has ${fromResources.fish}, needs ${o.fish}).`
  if (fromResources.wheat < o.wheat) return `${proposal.from} doesn't have enough wheat (has ${fromResources.wheat}, needs ${o.wheat}).`
  if (fromResources.coins < o.coins) return `${proposal.from} doesn't have enough coins (has ${fromResources.coins}, needs ${o.coins}).`

  // Check to has enough to give
  if (toResources.fish < r.fish) return `${proposal.to} doesn't have enough fish (has ${toResources.fish}, needs ${r.fish}).`
  if (toResources.wheat < r.wheat) return `${proposal.to} doesn't have enough wheat (has ${toResources.wheat}, needs ${r.wheat}).`
  if (toResources.coins < r.coins) return `${proposal.to} doesn't have enough coins (has ${toResources.coins}, needs ${r.coins}).`

  return null
}

const validationError = ref('')

async function acceptDeal() {
  if (!game.activeNegotiation) return
  const npcProposal = acceptableNpcProposal.value
  if (!npcProposal?.proposal) {
    validationError.value = `${targetMeta.value.name} hasn't made a concrete offer yet — counter or reject.`
    setTimeout(() => { validationError.value = '' }, 4000)
    return
  }

  const error = validateProposal(npcProposal.proposal)
  if (error) {
    validationError.value = error
    setTimeout(() => { validationError.value = '' }, 4000)
    return
  }

  validationError.value = ''
  await game.submitAction({
    type: 'negotiate_reply',
    conversationId: game.activeNegotiation.conversationId,
    message: 'I accept this deal!',
    accept: true,
  })
  emit('close')
}

async function rejectDeal() {
  if (!game.activeNegotiation) return
  const neg = game.activeNegotiation
  await game.submitAction({
    type: 'negotiate_reply',
    conversationId: neg.conversationId,
    message: 'No deal. I am walking away.',
    accept: false,
  })
  // Fully end negotiation — cannot be resumed
  game.endNegotiation()
  emit('close')
}

function speakerMeta(speakerId: string) {
  return CHARACTER_META[speakerId] ?? { name: speakerId, emoji: '?' }
}

/** Pretty-print a TradeOffer for proposal display. Returns null when nothing is offered. */
function formatOffer(offer: { fish: number; wheat: number; coins: number }): string | null {
  const parts: string[] = []
  if (offer.fish) parts.push(`${offer.fish} fish`)
  if (offer.wheat) parts.push(`${offer.wheat} wheat`)
  if (offer.coins) parts.push(`${offer.coins} coins`)
  if (parts.length === 0) return null
  return parts.join(', ')
}

function proposalSummary(msg: NegotiationMessage): { offer: string | null; request: string | null } {
  if (!msg.proposal) return { offer: null, request: null }
  return {
    offer: formatOffer(msg.proposal.offer),
    request: formatOffer(msg.proposal.request),
  }
}
</script>

<template>
  <div class="dialogue-panel">
    <!-- Header -->
    <div class="dialogue-header">
      <div class="dialogue-title">
        <span class="dialogue-title-icon">Chat</span>
        <span>{{ targetMeta.name }}</span>
      </div>
      <!-- Friendship hearts -->
      <div class="friendship-display" :style="{ color: friendshipColor }" :title="`${targetMeta.name}: ${friendship} friendship - ${friendshipHearts.label}`">
        <span v-for="i in friendshipHearts.filled" :key="'f'+i" class="heart filled">&#x2665;</span>
        <span v-for="i in friendshipHearts.empty" :key="'e'+i" class="heart empty">&#x2661;</span>
      </div>
      <div class="dialogue-header-right">
        <span class="message-count">
          {{ messageCount }}/{{ maxExchanges * 2 }}
        </span>
        <button class="close-btn" @click="emit('close')">X</button>
      </div>
    </div>

    <div class="dialogue-subtitle">{{ targetMeta.personality }}</div>

    <!-- Chat messages -->
    <div ref="chatContainer" class="chat-messages">
      <div v-if="messages.length === 0 && !showThinking" class="chat-empty">
        {{ game.activeNegotiation?.isNew ? 'Start the conversation with a trade proposal below...' : 'Continuing previous conversation...' }}
      </div>
      <div
        v-for="(msg, i) in messages"
        :key="i"
        :class="['chat-bubble-row', msg.speaker === 'player' ? 'chat-bubble-right' : 'chat-bubble-left']"
      >
        <div :class="['chat-bubble', msg.speaker === 'player' ? 'bubble-player' : 'bubble-npc']">
          <div class="bubble-speaker">{{ speakerMeta(msg.speaker).name }}</div>
          <div class="bubble-text">{{ msg.text }}</div>
          <div v-if="msg.proposal" class="proposal-block">
            <div class="proposal-row">
              <span class="proposal-label">Offers</span>
              <span class="proposal-value">{{ proposalSummary(msg).offer ?? 'nothing' }}</span>
            </div>
            <div class="proposal-row">
              <span class="proposal-label">Wants</span>
              <span class="proposal-value">{{ proposalSummary(msg).request ?? 'nothing' }}</span>
            </div>
          </div>
          <div v-if="msg.accept === true" class="proposal-tag tag-accept">Accepted</div>
        </div>
      </div>
      <!-- Thinking indicator while server is awaiting LLM reply -->
      <div v-if="showThinking" class="chat-bubble-row chat-bubble-left">
        <div class="chat-bubble bubble-npc thinking-bubble">
          <div class="bubble-speaker">{{ targetMeta.name }}</div>
          <div class="thinking-dots" aria-label="thinking">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Trade Proposal -->
    <div v-if="canSend" class="trade-template">
      <div class="template-label">Quick Trade</div>
      <div class="template-row">
        <select v-model="templateAction" class="template-select">
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
        <input
          v-model.number="templateAmount"
          type="number"
          :min="1"
          :max="20"
          class="template-input"
        />
        <select v-model="templateResource" class="template-select">
          <option value="fish">Fish</option>
          <option value="wheat">Wheat</option>
        </select>
        <span class="template-for">for</span>
        <input
          v-model.number="templatePrice"
          type="number"
          :min="1"
          :max="99"
          class="template-input"
        />
        <span class="template-for">c</span>
        <button class="propose-btn" @click="sendTemplate">
          Propose
        </button>
      </div>
    </div>

    <!-- Free-form input -->
    <div v-if="canSend" class="freeform-input">
      <input
        v-model="freeFormMessage"
        type="text"
        placeholder="Type a message..."
        class="freeform-text"
        @keyup.enter="sendFreeForm"
      />
      <button
        :disabled="!freeFormMessage.trim()"
        :class="['send-btn', freeFormMessage.trim() ? 'send-btn-active' : 'send-btn-disabled']"
        @click="sendFreeForm"
      >
        Send
      </button>
    </div>

    <!-- Validation Error -->
    <div v-if="validationError" class="validation-error">
      {{ validationError }}
    </div>

    <!-- Accept hint when no NPC offer is on the table -->
    <div v-else-if="!canAccept" class="accept-hint">
      Wait for {{ targetMeta.name }} to make a concrete offer before accepting.
    </div>

    <!-- Accept / Reject -->
    <div class="deal-buttons">
      <button
        :disabled="!canAccept"
        :class="['deal-accept', canAccept ? '' : 'deal-disabled']"
        @click="acceptDeal"
      >
        Accept Deal
      </button>
      <button class="deal-reject" @click="rejectDeal">Reject</button>
    </div>
  </div>
</template>

<style scoped>
.dialogue-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1a1a2e;
  border-left: 2px solid #2a3a5a;
  color: #c8d8e8;
  font-family: monospace;
  font-size: 12px;
}

.dialogue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #222244;
  border-bottom: 1px solid #3a3a5a;
}

.dialogue-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: bold;
  font-size: 13px;
}

.dialogue-title-icon {
  background: #6b46c1;
  color: #fff;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
}

.dialogue-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.friendship-display {
  display: flex;
  align-items: center;
  gap: 1px;
  font-size: 12px;
  cursor: default;
}
.heart.filled {
  color: inherit;
}
.heart.empty {
  opacity: 0.35;
}

.message-count {
  background: #3a3a5a;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 10px;
  color: #9a9aba;
}

.close-btn {
  background: none;
  border: none;
  color: #7a7a9a;
  cursor: pointer;
  font-size: 12px;
  font-family: monospace;
  padding: 2px 4px;
}
.close-btn:hover {
  color: #ff6666;
}

.dialogue-subtitle {
  padding: 4px 12px;
  font-size: 10px;
  color: #7a7a9a;
  border-bottom: 1px solid #2a2a4a;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 100px;
}

.chat-empty {
  text-align: center;
  color: #5a5a7a;
  padding: 24px 8px;
  font-size: 11px;
}

.chat-bubble-row {
  display: flex;
}
.chat-bubble-right {
  justify-content: flex-end;
}
.chat-bubble-left {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 85%;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.4;
}

.bubble-player {
  background: #1a4a3a;
  color: #a0dcc0;
}

.bubble-npc {
  background: #2a2a4a;
  color: #b0b0d0;
}

.bubble-speaker {
  font-size: 9px;
  font-weight: bold;
  margin-bottom: 2px;
  opacity: 0.7;
}

.bubble-text {
  word-break: break-word;
}

.proposal-block {
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(200, 160, 96, 0.32);
  font-size: 10px;
  line-height: 1.4;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.proposal-row {
  display: flex;
  gap: 6px;
  align-items: baseline;
}
.proposal-label {
  flex-shrink: 0;
  width: 48px;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #c8a060;
}
.proposal-value {
  font-weight: 700;
  color: #e6d2a3;
}
.proposal-tag {
  display: inline-block;
  margin-top: 6px;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.tag-accept {
  background: rgba(34, 170, 85, 0.22);
  color: #8aff88;
  border: 1px solid rgba(34, 170, 85, 0.5);
}

.accept-hint {
  padding: 6px 10px;
  margin: 0 8px;
  background: rgba(132, 186, 230, 0.08);
  border: 1px solid rgba(132, 186, 230, 0.25);
  border-radius: 4px;
  color: #aac5d8;
  font-size: 10px;
  line-height: 1.4;
  font-family: monospace;
}

.thinking-bubble {
  padding-bottom: 8px;
}
.thinking-dots {
  display: inline-flex;
  gap: 4px;
  padding: 4px 0 2px;
}
.thinking-dots .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8a8aa8;
  animation: think-bounce 1.2s infinite ease-in-out both;
}
.thinking-dots .dot:nth-child(1) { animation-delay: -0.32s; }
.thinking-dots .dot:nth-child(2) { animation-delay: -0.16s; }
@keyframes think-bounce {
  0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
  40% { transform: scale(1.1); opacity: 1; }
}

.trade-template {
  padding: 8px;
  background: #1a1a3a;
  border-top: 1px solid #2a2a4a;
}

.template-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6b46c1;
  font-weight: bold;
  margin-bottom: 4px;
}

.template-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.template-select {
  background: #2a2a4a;
  border: 1px solid #3a3a5a;
  color: #c8d8e8;
  padding: 3px 4px;
  border-radius: 3px;
  font-size: 11px;
  font-family: monospace;
}

.template-input {
  width: 40px;
  background: #2a2a4a;
  border: 1px solid #3a3a5a;
  color: #c8d8e8;
  padding: 3px 4px;
  border-radius: 3px;
  font-size: 11px;
  text-align: center;
  font-family: monospace;
}

.template-for {
  color: #5a5a7a;
  font-size: 10px;
}

.propose-btn {
  background: #6b46c1;
  color: #fff;
  border: none;
  padding: 3px 10px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
  cursor: pointer;
  font-family: monospace;
}
.propose-btn:hover {
  background: #7c56d1;
}

.freeform-input {
  display: flex;
  gap: 4px;
  padding: 6px 8px;
  border-top: 1px solid #2a2a4a;
}

.freeform-text {
  flex: 1;
  background: #2a2a4a;
  border: 1px solid #3a3a5a;
  color: #c8d8e8;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-family: monospace;
}
.freeform-text:focus {
  outline: none;
  border-color: #6b46c1;
}

.send-btn {
  border: none;
  padding: 5px 12px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: bold;
  cursor: pointer;
  font-family: monospace;
}
.send-btn-active {
  background: #6b46c1;
  color: #fff;
}
.send-btn-active:hover {
  background: #7c56d1;
}
.send-btn-disabled {
  background: #2a2a4a;
  color: #5a5a7a;
  cursor: not-allowed;
}

.deal-buttons {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid #2a2a4a;
}

.deal-accept {
  flex: 1;
  background: #16a34a;
  color: #fff;
  border: none;
  padding: 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  cursor: pointer;
  font-family: monospace;
}
.deal-accept:hover {
  background: #1db954;
}
.deal-disabled {
  background: #2a3a4a !important;
  color: #5a6a7a !important;
  cursor: not-allowed;
}
.deal-disabled:hover {
  background: #2a3a4a !important;
}

.deal-reject {
  flex: 1;
  background: #dc2626;
  color: #fff;
  border: none;
  padding: 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  cursor: pointer;
  font-family: monospace;
}
.deal-reject:hover {
  background: #ef4444;
}

.validation-error {
  padding: 6px 8px;
  margin: 0 8px;
  background: rgba(220, 38, 38, 0.15);
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: 4px;
  color: #f87171;
  font-size: 10px;
  font-family: monospace;
}
</style>

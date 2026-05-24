import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type {
  GameState,
  GameSSEEvent,
  PlayerAction,
  CharacterId,
  CharacterState,
  NegotiationMessage,
} from '@game/shared'
import { friendshipKey } from '@game/shared'
import { createGame, submitAction as apiSubmitAction, getSSEUrl } from '@/composables/useApi'
import type { InteractionType } from '@/game/GameWorld'

export interface NegotiationState {
  conversationId: string
  target: CharacterId
  messages: NegotiationMessage[]
  isOpen: boolean
  /** true = first message not yet sent to server (trade_peer not called) */
  isNew: boolean
}

export const CHARACTER_META: Record<string, { name: string; personality: string; emoji: string }> = {
  player: { name: 'You', personality: 'Resourceful', emoji: '🧑' },
  tom: { name: 'Tom', personality: 'Cautious Fisherman', emoji: '🧔' },
  sam: { name: 'Sam', personality: 'Aggressive Trader', emoji: '👩' },
  lily: { name: 'Lily', personality: 'Friendly Helper', emoji: '👧' },
  jack: { name: 'Jack', personality: 'Cunning Schemer', emoji: '🤠' },
}

export const useGameStore = defineStore('game', () => {
  // ---- Core state ----
  const gameId = ref<string | null>(null)
  const state = ref<GameState | null>(null)
  const events = ref<GameSSEEvent[]>([])
  const isLoading = ref(false)
  const activeNegotiation = ref<NegotiationState | null>(null)
  const thinkingCharacter = ref<CharacterId | null>(null)
  /** Set to the NPC id while we are awaiting an LLM reply during a negotiation HTTP round-trip. */
  const negotiationPending = ref<CharacterId | null>(null)
  const errorMessage = ref<string | null>(null)

  // ---- Map / interaction state (for PixiJS ↔ Vue bridge) ----
  const currentInteraction = ref<InteractionType>(null)
  const showActionMenu = ref(false)
  const showDialoguePanel = ref(false)
  const dialogueTarget = ref<CharacterId | null>(null)

  // ---- Dungeon state ----
  const dungeonMode = ref(false)
  const showCardPicker = ref(false)
  const pendingCards = ref<Array<{ id: string; name: string; description: string; icon: string }>>([])
  const dungeonStats = ref({ hp: 15, maxHp: 15, bossHp: 120, bossMaxHp: 120, xp: 0, xpNext: 30 })
  const dungeonResult = ref<{ win: boolean; damageDealt: number; damageTaken: number; cardsCollected: number } | null>(null)

  // ---- SSE management ----
  let eventSource: EventSource | null = null

  // ---- Computed ----
  const playerState = computed<CharacterState | null>(() => {
    if (!state.value) return null
    return state.value.characters['player'] ?? null
  })

  const day = computed(() => state.value?.day ?? 1)
  const phase = computed(() => state.value?.phase ?? 'day_start')
  const merchantPrices = computed(() => state.value?.merchantPrices ?? { fishPrice: 3, wheatPrice: 2 })
  const isPlayerTurn = computed(() => state.value?.phase === 'player_labor' || state.value?.phase === 'player_trade')
  const isGameOver = computed(() => state.value?.phase === 'game_over')

  const allCharacters = computed<CharacterState[]>(() => {
    if (!state.value) return []
    return Object.values(state.value.characters).filter((c): c is CharacterState => c !== undefined)
  })

  const playerTradeSlots = computed(() => playerState.value?.tradeSlots ?? 0)

  function getFriendship(charId: CharacterId): number {
    if (!state.value) return 0
    const key = friendshipKey('player', charId)
    return state.value.friendship[key] ?? 0
  }

  const aliveNPCs = computed<CharacterState[]>(() => {
    return allCharacters.value.filter(c => c.id !== 'player' && c.alive && !c.escaped)
  })

  const winner = computed(() => state.value?.winnerId ?? null)

  const playerAlive = computed(() => playerState.value?.alive ?? true)
  const playerEscaped = computed(() => playerState.value?.escaped ?? false)

  /** NPCs the player has already traded with today */
  const playerNpcTradedToday = computed<CharacterId[]>(() => {
    return state.value?.playerNpcTradedToday ?? []
  })

  /** Check if player can trade with a specific NPC */
  function canTradeWithNpc(npcId: CharacterId): boolean {
    return !playerNpcTradedToday.value.includes(npcId)
  }

  // ---- Actions ----
  async function newGame() {
    disconnectSSE()
    isLoading.value = true
    events.value = []
    activeNegotiation.value = null
    thinkingCharacter.value = null
    currentInteraction.value = null
    showActionMenu.value = false
    showDialoguePanel.value = false
    dialogueTarget.value = null
    try {
      const res = await createGame()
      gameId.value = res.gameId
      state.value = res.state
      connectSSE()
    } finally {
      isLoading.value = false
    }
  }

  async function submitAction(action: PlayerAction) {
    if (!gameId.value) return
    isLoading.value = true

    // Optimistic chat: surface the player's message in the dialogue panel BEFORE
    // we await the server's LLM round-trip. Server's authoritative message list
    // replaces this on response (which de-duplicates the optimistic entry).
    let optimisticPushed = false
    if (action.type === 'trade_peer' || action.type === 'negotiate_reply') {
      const target =
        action.type === 'trade_peer'
          ? action.target
          : (activeNegotiation.value?.target ?? null)
      if (target) {
        if (!activeNegotiation.value || activeNegotiation.value.target !== target) {
          activeNegotiation.value = {
            conversationId:
              action.type === 'negotiate_reply' ? action.conversationId : `conv_${Date.now()}`,
            target,
            messages: [],
            isOpen: true,
            isNew: action.type === 'trade_peer',
          }
          showDialoguePanel.value = true
          dialogueTarget.value = target
        }
        activeNegotiation.value.messages = [
          ...activeNegotiation.value.messages,
          {
            speaker: 'player',
            text: action.message,
            ...('proposal' in action && action.proposal ? { proposal: action.proposal } : {}),
            ...('accept' in action && action.accept !== undefined ? { accept: action.accept } : {}),
          },
        ]
        // For accept/reject, the server short-circuits (no LLM call) — only show
        // the thinking bubble for messages that will actually trigger an NPC reply.
        if (!('accept' in action) || action.accept === undefined) {
          negotiationPending.value = target
        }
        optimisticPushed = true
      }
    }

    try {
      const res = await apiSubmitAction(gameId.value, action) as Record<string, unknown>
      state.value = res.state as GameState

      // Handle negotiation responses from server
      if (res.negotiation) {
        const neg = res.negotiation as { conversationId: string; messages: NegotiationMessage[] }
        if (!activeNegotiation.value || activeNegotiation.value.target !== (action as { target?: CharacterId }).target) {
          // Starting new negotiation (or target changed)
          activeNegotiation.value = {
            conversationId: neg.conversationId,
            target: (action as { target?: CharacterId }).target ?? dialogueTarget.value ?? 'tom',
            messages: neg.messages,
            isOpen: true,
            isNew: false,
          }
          showDialoguePanel.value = true
          dialogueTarget.value = activeNegotiation.value.target
        } else {
          // Update existing negotiation with server's authoritative data
          activeNegotiation.value.conversationId = neg.conversationId
          activeNegotiation.value.messages = neg.messages
          activeNegotiation.value.isNew = false
        }
      }

      if (res.negotiationDone) {
        // Negotiation truly ended (trade completed or rejected)
        // Clear negotiation state after a brief delay so user sees the result
        setTimeout(() => {
          endNegotiation()
        }, 2000)
      }

      // Enter dungeon mode if state indicates active dungeon
      if (state.value?.dungeonState?.active && !dungeonMode.value) {
        dungeonMode.value = true
      }
      if (!state.value?.dungeonState?.active && dungeonMode.value && !dungeonResult.value) {
        dungeonMode.value = false
      }
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Action failed'
      setTimeout(() => { errorMessage.value = null }, 3000)
      // Roll back the optimistic message so the user can retry from a clean state
      if (optimisticPushed && activeNegotiation.value) {
        activeNegotiation.value.messages = activeNegotiation.value.messages.slice(0, -1)
      }
    } finally {
      isLoading.value = false
      negotiationPending.value = null
    }
  }

  function connectSSE() {
    if (!gameId.value) return
    disconnectSSE()

    const url = getSSEUrl(gameId.value)
    eventSource = new EventSource(url)

    eventSource.onmessage = (ev) => {
      try {
        const event: GameSSEEvent = JSON.parse(ev.data)
        events.value.push(event)
        // LOGIC 7: Cap events array to prevent memory leak
        if (events.value.length > 200) {
          events.value = events.value.slice(-200)
        }
        handleSSEEvent(event)
      } catch {
        // ignore parse errors
      }
    }

    eventSource.onerror = () => {
      if (eventSource?.readyState === EventSource.CLOSED) {
        setTimeout(() => {
          if (gameId.value && !isGameOver.value) {
            connectSSE()
          }
        }, 3000)
      }
    }
  }

  function disconnectSSE() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
  }

  function handleSSEEvent(event: GameSSEEvent) {
    switch (event.type) {
      case 'state_update':
        state.value = event.state
        thinkingCharacter.value = null
        break
      case 'ai_thinking':
        thinkingCharacter.value = event.characterId
        break
      case 'ai_decision':
        thinkingCharacter.value = null
        break
      case 'negotiation':
        // Negotiation messages are handled via HTTP response in submitAction.
        // SSE events for player-initiated negotiations are intentionally ignored
        // to prevent double-display. SSE negotiation events for AI-to-AI talks
        // only show in EventLog (via events array), not in DialoguePanel.
        break
      case 'npc_initiates_negotiation': {
        // An NPC opened a chat with the player. Surface it as an active
        // negotiation so the existing DialoguePanel pops up and the player
        // can respond via the normal negotiate_reply flow.
        const ev = event as { initiatorId: CharacterId; conversationId: string; message: NegotiationMessage }
        // Skip if the player is already mid-negotiation with someone — server
        // prevents creating a new one anyway.
        if (activeNegotiation.value && activeNegotiation.value.target !== ev.initiatorId) break
        activeNegotiation.value = {
          conversationId: ev.conversationId,
          target: ev.initiatorId,
          messages: [ev.message],
          isOpen: true,
          isNew: false,
        }
        dialogueTarget.value = ev.initiatorId
        showDialoguePanel.value = true
        thinkingCharacter.value = null
        break
      }
      case 'game_over':
        thinkingCharacter.value = null
        break
      case 'day_start':
        thinkingCharacter.value = null
        break
    }
  }

  function openNegotiation(target: CharacterId, conversationId: string) {
    // Resume existing negotiation with this target if one is active
    if (activeNegotiation.value && activeNegotiation.value.target === target) {
      dialogueTarget.value = target
      showDialoguePanel.value = true
      showActionMenu.value = false
      return
    }
    // If there's an active negotiation with a different NPC, don't create a new one
    if (activeNegotiation.value && activeNegotiation.value.target !== target) {
      return
    }
    activeNegotiation.value = {
      conversationId,
      target,
      messages: [],
      isOpen: true,
      isNew: true,
    }
    dialogueTarget.value = target
    showDialoguePanel.value = true
    showActionMenu.value = false
  }

  function closeNegotiation() {
    // If no message was ever sent (isNew), the negotiation never started server-side.
    // Clear everything so the player can open a different NPC's dialogue.
    if (activeNegotiation.value?.isNew) {
      activeNegotiation.value = null
    }
    showDialoguePanel.value = false
    dialogueTarget.value = null
  }

  /** Fully end a negotiation — clear all state, conversation cannot be resumed */
  function endNegotiation() {
    activeNegotiation.value = null
    showDialoguePanel.value = false
    dialogueTarget.value = null
  }

  // ---- Interaction helpers ----
  function setInteraction(interaction: InteractionType) {
    currentInteraction.value = interaction
  }

  function openActionMenu() {
    if (!currentInteraction.value || !isPlayerTurn.value) return
    showActionMenu.value = true
  }

  function closeActionMenu() {
    showActionMenu.value = false
  }

  // ---- Dungeon methods ----
  function enterDungeon() {
    dungeonMode.value = true
    showActionMenu.value = false
  }

  function onDungeonEvent(event: { type: string; [key: string]: unknown }) {
    switch (event.type) {
      case 'card_pick': {
        pendingCards.value = event.cards as Array<{ id: string; name: string; description: string; icon: string }>
        showCardPicker.value = true
        break
      }
      case 'stats_update': {
        dungeonStats.value = {
          hp: event.hp as number,
          maxHp: event.maxHp as number,
          bossHp: event.bossHp as number,
          bossMaxHp: event.bossMaxHp as number,
          xp: event.xp as number,
          xpNext: event.xpNext as number,
        }
        break
      }
      case 'boss_defeated':
      case 'player_died':
        dungeonResult.value = {
          win: event.type === 'boss_defeated',
          damageDealt: event.damageDealt as number,
          damageTaken: event.damageTaken as number,
          cardsCollected: event.cardsCollected as number,
        }
        break
    }
  }

  function pickCard(cardId: string) {
    pendingCards.value = []
    showCardPicker.value = false
  }

  async function submitDungeonResult(win: boolean) {
    if (!gameId.value) return
    const result = {
      win,
      damageDealt: dungeonResult.value?.damageDealt ?? 0,
      damageTaken: dungeonResult.value?.damageTaken ?? 0,
      cardsCollected: dungeonResult.value?.cardsCollected ?? 0,
    }
    dungeonResult.value = null
    dungeonStats.value = { hp: 15, maxHp: 15, bossHp: 120, bossMaxHp: 120, xp: 0, xpNext: 30 }
    await submitAction({ type: 'dungeon_result', result })
    // dungeonMode will be set to false by the submitAction handler when state.dungeonState becomes null
  }

  async function leaveDungeon() {
    if (!gameId.value) return
    dungeonResult.value = null
    dungeonStats.value = { hp: 15, maxHp: 15, bossHp: 120, bossMaxHp: 120, xp: 0, xpNext: 30 }
    await submitAction({ type: 'leave_dungeon' })
    // dungeonMode will be set to false by the submitAction handler
  }

  return {
    // state
    gameId,
    state,
    events,
    isLoading,
    errorMessage,
    activeNegotiation,
    thinkingCharacter,
    negotiationPending,
    currentInteraction,
    showActionMenu,
    showDialoguePanel,
    dialogueTarget,
    // computed
    playerState,
    day,
    phase,
    merchantPrices,
    isPlayerTurn,
    isGameOver,
    allCharacters,
    playerTradeSlots,
    aliveNPCs,
    winner,
    playerAlive,
    playerEscaped,
    playerNpcTradedToday,
    canTradeWithNpc,
    // methods
    getFriendship,
    newGame,
    submitAction,
    connectSSE,
    disconnectSSE,
    openNegotiation,
    closeNegotiation,
    endNegotiation,
    setInteraction,
    openActionMenu,
    closeActionMenu,
    // dungeon
    dungeonMode,
    showCardPicker,
    pendingCards,
    dungeonStats,
    dungeonResult,
    enterDungeon,
    onDungeonEvent,
    pickCard,
    submitDungeonResult,
    leaveDungeon,
  }
})

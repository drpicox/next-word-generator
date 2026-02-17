import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './App.module.css'
import { BigramModel } from './models/BigramModel'
import { TrigramModel } from './models/TrigramModel'
import { TetragramModel } from './models/TetragramModel'
import type { BigramEntry } from './models/BigramModel'
import type { TrigramEntry } from './models/TrigramModel'
import type { TetragramEntry } from './models/TetragramModel'
import { normalizeText } from './utils/normalize'
import { tokenize } from './utils/tokenize'
import { tokensToText } from './utils/format'
import { applyTemperature, sampleCandidate } from './utils/sample'
import { levenshtein } from './utils/levenshtein'
import { CorpusTab } from './components/CorpusTab'
import { BigramList } from './components/BigramList'
import { TrigramList } from './components/TrigramList'
import { TetragramList } from './components/TetragramList'
import { GeneratorControls } from './components/GeneratorControls'
import { GeneratedText } from './components/GeneratedText'
import { ContextView } from './components/ContextView'

type CorpusManifestItem = {
  id: string
  title: string
  category: string
  type: string
  language: string
  file: string
}

type CorpusOption = {
  id: string
  label: string
  file: string
  text?: string
}

const DEFAULT_CORPUS =
  'el gat està content. el gos és feliç. el gat dorm. el gos juga. el gat menja. el gos corre. el cotxe és ràpid. el cotxe va lluny.'

const EXTENDED_CORPUS =
  `la pluja cau lenta. el sol surt a poc a poc. la nena llegeix un llibre. el noi escriu una carta. la ciutat dorm però el tren passa. el carrer és buit i tranquil. el vent porta olor de mar. el matí arriba amb calma. la pluja es fa fina i el vent baixa. el sol torna i la ciutat es desperta. la nena guarda el llibre i somriu. el noi llegeix la carta i respira. el tren arriba tard però passa de pressa. el carrer queda buit i el silenci dura. el mar és calmat i l'olor és dolça. la calma del matí es queda una estona.`

const BASIC_CORPUS_OPTION: CorpusOption = {
  id: 'basic',
  label: 'Corpus bàsic',
  file: '',
  text: DEFAULT_CORPUS,
}

const EXTENDED_CORPUS_OPTION: CorpusOption = {
  id: 'extended',
  label: 'Corpus ampliat',
  file: '',
  text: EXTENDED_CORPUS,
}

const CUSTOM_CORPUS_OPTION: CorpusOption = {
  id: 'custom',
  label: 'Personalitzat',
  file: '',
}

const DEFAULT_TEMPERATURE = 0.7

function stripFrontmatter(text: string): string {
  const normalized = text.replace(/^\uFEFF/, '')
  const match = normalized.match(/^\s*---\s*\n[\s\S]*?\n---\s*\n?/)
  if (!match) return text
  return normalized.slice(match[0].length).replace(/^\s+/, '')
}

type ContextMatch = {
  startIndex: number
  length: number
}

function findBestContextMatch(
  corpusTokens: string[],
  contextTokens: string[],
  nextToken: string | null,
): ContextMatch | null {
  if (contextTokens.length === 0) return null
  let fallbackMatch: ContextMatch | null = null
  for (let i = 0; i <= corpusTokens.length - contextTokens.length; i += 1) {
    let matches = true
    for (let j = 0; j < contextTokens.length; j += 1) {
      if (corpusTokens[i + j] !== contextTokens[j]) {
        matches = false
        break
      }
    }
    if (!matches) continue
    if (nextToken) {
      if (corpusTokens[i + contextTokens.length] === nextToken) {
        return { startIndex: i, length: contextTokens.length }
      }
    }
    if (!fallbackMatch) {
      fallbackMatch = { startIndex: i, length: contextTokens.length }
    }
  }
  if (fallbackMatch) return fallbackMatch

  let bestIndex = -1
  let bestScore = Number.POSITIVE_INFINITY
  for (let i = 0; i <= corpusTokens.length - contextTokens.length; i += 1) {
    let score = 0
    for (let j = 0; j < contextTokens.length; j += 1) {
      score += levenshtein(contextTokens[j], corpusTokens[i + j])
    }
    if (score < bestScore) {
      bestScore = score
      bestIndex = i
    }
  }
  if (bestIndex >= 0) {
    return { startIndex: bestIndex, length: contextTokens.length }
  }
  return null
}

function App() {
  const [corpusText, setCorpusText] = useState(DEFAULT_CORPUS)
  const [selectedCorpusId, setSelectedCorpusId] = useState('basic')
  const [corpusOptions, setCorpusOptions] = useState<CorpusOption[]>([
    BASIC_CORPUS_OPTION,
    EXTENDED_CORPUS_OPTION,
    CUSTOM_CORPUS_OPTION,
  ])
  const [isLoadingCorpus, setIsLoadingCorpus] = useState(false)
  const [lastTrainedCorpus, setLastTrainedCorpus] = useState('')
  const [bigramModel, setBigramModel] = useState(() => new BigramModel())
  const [trigramModel, setTrigramModel] = useState(() => new TrigramModel())
  const [tetragramModel, setTetragramModel] = useState(() => new TetragramModel())
  const [bigrams, setBigrams] = useState<BigramEntry[]>([])
  const [trigrams, setTrigrams] = useState<TrigramEntry[]>([])
  const [tetragrams, setTetragrams] = useState<TetragramEntry[]>([])
  const [seedText, setSeedText] = useState('')
  const [generatedTokens, setGeneratedTokens] = useState<string[]>([])
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE)
  const [activeTab, setActiveTab] = useState<'corpus' | 'bigrams' | 'context'>('corpus')
  const [filterCurrentOnly, setFilterCurrentOnly] = useState(false)
  const [modelType, setModelType] = useState('bigrams')
  const [isAnimating, setIsAnimating] = useState(false)
  const [predictedNext, setPredictedNext] = useState<string | null>(null)
  const [predictedContext, setPredictedContext] = useState<string | null>(null)
  const [predictedTrigramContext, setPredictedTrigramContext] = useState<{
    prev1: string
    prev2: string
  } | null>(null)
  const [predictedTetragramContext, setPredictedTetragramContext] = useState<{
    prev1: string
    prev2: string
    prev3: string
  } | null>(null)
  const [isPresentationMode, setIsPresentationMode] = useState(false)
  const [manualSelection, setManualSelection] = useState<{
    context: string
    next: string
  } | null>(null)
  const [manualTrigramSelection, setManualTrigramSelection] = useState<{
    prev1: string
    prev2: string
    next: string
  } | null>(null)
  const [manualTetragramSelection, setManualTetragramSelection] = useState<{
    prev1: string
    prev2: string
    prev3: string
    next: string
  } | null>(null)
  const intervalRef = useRef<number | null>(null)

  const seedTokens = useMemo(() => tokenize(normalizeText(seedText)), [seedText])
  const outputTokens = useMemo(
    () => [...seedTokens, ...generatedTokens],
    [seedTokens, generatedTokens],
  )
  const outputText = useMemo(() => tokensToText(outputTokens), [outputTokens])
  const currentToken = outputTokens.length > 0 ? outputTokens[outputTokens.length - 1] : null
  const currentPrev2 = outputTokens.length > 0 ? outputTokens[outputTokens.length - 1] : null
  const currentPrev1 = outputTokens.length > 1 ? outputTokens[outputTokens.length - 2] : null
  const currentPrev3 = outputTokens.length > 2 ? outputTokens[outputTokens.length - 3] : null
  const resolvedToken = currentToken ? bigramModel.resolveToken(currentToken) : null
  const resolvedTriPrev1 = currentPrev1 ? trigramModel.resolveToken(currentPrev1) : null
  const resolvedTriPrev2 = currentPrev2 ? trigramModel.resolveToken(currentPrev2) : null
  const resolvedTetPrev1 = currentPrev3 ? tetragramModel.resolveToken(currentPrev3) : null
  const resolvedTetPrev2 = currentPrev1 ? tetragramModel.resolveToken(currentPrev1) : null
  const resolvedTetPrev3 = currentPrev2 ? tetragramModel.resolveToken(currentPrev2) : null

  const corpusTokens = useMemo(() => tokenize(normalizeText(corpusText)), [corpusText])

  const contextFragment = useMemo(() => {
    if (corpusTokens.length === 0) return null
    let contextTokens: string[] = []
    if (modelType === 'bigrams' && resolvedToken) {
      contextTokens = [resolvedToken]
    } else if (modelType === 'trigrams' && resolvedTriPrev1 && resolvedTriPrev2) {
      contextTokens = [resolvedTriPrev1, resolvedTriPrev2]
    } else if (
      modelType === 'tetragrams' &&
      resolvedTetPrev1 &&
      resolvedTetPrev2 &&
      resolvedTetPrev3
    ) {
      contextTokens = [resolvedTetPrev1, resolvedTetPrev2, resolvedTetPrev3]
    }
    if (contextTokens.length === 0) return null
    const match = findBestContextMatch(corpusTokens, contextTokens, predictedNext)
    if (!match) return null
    const beforeCount = 125
    const afterCount = 125
    const start = Math.max(0, match.startIndex - beforeCount)
    const end = Math.min(
      corpusTokens.length,
      match.startIndex + match.length + 1 + afterCount,
    )
    const tokens = corpusTokens.slice(start, end)
    const contextStart = match.startIndex - start
    const contextEnd = contextStart + match.length - 1
    const nextIndexGlobal = match.startIndex + match.length
    const nextIndex =
      predictedNext && nextIndexGlobal < end && corpusTokens[nextIndexGlobal] === predictedNext
        ? nextIndexGlobal - start
        : null
    return { tokens, contextStart, contextEnd, nextIndex }
  }, [
    corpusTokens,
    modelType,
    predictedNext,
    resolvedToken,
    resolvedTriPrev1,
    resolvedTriPrev2,
    resolvedTetPrev1,
    resolvedTetPrev2,
    resolvedTetPrev3,
  ])

  const stopAnimation = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsAnimating(false)
  }, [])

  const handleSeedChange = useCallback(
    (value: string) => {
      stopAnimation()
      setGeneratedTokens([])
      setSeedText(value)
    },
    [stopAnimation],
  )

  const trainModel = useCallback(() => {
    const trainedBigram = new BigramModel()
    const trainedTrigram = new TrigramModel()
    const trainedTetragram = new TetragramModel()
    trainedBigram.train(corpusText)
    trainedTrigram.train(corpusText)
    trainedTetragram.train(corpusText)
    setBigramModel(trainedBigram)
    setTrigramModel(trainedTrigram)
    setTetragramModel(trainedTetragram)
    setBigrams(trainedBigram.getAllBigrams())
    setTrigrams(trainedTrigram.getAllTrigrams())
    setTetragrams(trainedTetragram.getAllTetragrams())
    setLastTrainedCorpus(corpusText)
  }, [corpusText])

  const ensureModels = useCallback(() => {
    if (!bigramModel.isEmpty() && !trigramModel.isEmpty() && !tetragramModel.isEmpty()) {
      return { bigram: bigramModel, trigram: trigramModel, tetragram: tetragramModel }
    }
    const trainedBigram = new BigramModel()
    const trainedTrigram = new TrigramModel()
    const trainedTetragram = new TetragramModel()
    trainedBigram.train(corpusText)
    trainedTrigram.train(corpusText)
    trainedTetragram.train(corpusText)
    setBigramModel(trainedBigram)
    setTrigramModel(trainedTrigram)
    setTetragramModel(trainedTetragram)
    setBigrams(trainedBigram.getAllBigrams())
    setTrigrams(trainedTrigram.getAllTrigrams())
    setTetragrams(trainedTetragram.getAllTetragrams())
    setLastTrainedCorpus(corpusText)
    return { bigram: trainedBigram, trigram: trainedTrigram, tetragram: trainedTetragram }
  }, [bigramModel, trigramModel, tetragramModel, corpusText])

  const getNextTokenBigram = useCallback(
    (baseTokens: string[], activeModel: BigramModel): string | null => {
      let context = baseTokens[baseTokens.length - 1]
      if (!context) {
        context = activeModel.getMostCommonToken() ?? ''
      }
      const resolved = activeModel.resolveToken(context) ?? activeModel.getMostCommonToken()
      if (!resolved) return null
      const candidates = activeModel.getCandidates(resolved)
      if (candidates.length === 0) return null

      if (temperature <= 0) {
        return candidates[0].token
      }

      const adjusted = applyTemperature(
        candidates.map((candidate) => ({ token: candidate.token, prob: candidate.prob })),
        temperature,
      )
      const sampled = sampleCandidate(adjusted)
      return sampled ? sampled.token : null
    },
    [temperature],
  )

  const getNextTokenTrigram = useCallback(
    (
      baseTokens: string[],
      activeTrigram: TrigramModel,
      fallbackBigram: BigramModel,
    ): string | null => {
      const prev2 = baseTokens[baseTokens.length - 1]
      const prev1 = baseTokens[baseTokens.length - 2]
      if (!prev1 || !prev2) {
        return getNextTokenBigram(baseTokens, fallbackBigram)
      }
      const resolvedPrev1 = activeTrigram.resolveToken(prev1)
      const resolvedPrev2 = activeTrigram.resolveToken(prev2)
      if (!resolvedPrev1 || !resolvedPrev2) {
        return getNextTokenBigram(baseTokens, fallbackBigram)
      }
      const result = activeTrigram.getCandidatesForContext(resolvedPrev1, resolvedPrev2)
      const candidates = result ? result.candidates : []
      if (candidates.length === 0) return getNextTokenBigram(baseTokens, fallbackBigram)
      if (temperature <= 0) {
        return candidates[0].token
      }
      const adjusted = applyTemperature(
        candidates.map((candidate) => ({ token: candidate.token, prob: candidate.prob })),
        temperature,
      )
      const sampled = sampleCandidate(adjusted)
      return sampled ? sampled.token : null
    },
    [temperature, getNextTokenBigram],
  )

  const getNextTokenTetragram = useCallback(
    (
      baseTokens: string[],
      activeTetragram: TetragramModel,
      fallbackTrigram: TrigramModel,
      fallbackBigram: BigramModel,
    ): string | null => {
      const prev3 = baseTokens[baseTokens.length - 1]
      const prev2 = baseTokens[baseTokens.length - 2]
      const prev1 = baseTokens[baseTokens.length - 3]
      if (!prev1 || !prev2 || !prev3) {
        return getNextTokenTrigram(baseTokens, fallbackTrigram, fallbackBigram)
      }
      const resolvedPrev1 = activeTetragram.resolveToken(prev1)
      const resolvedPrev2 = activeTetragram.resolveToken(prev2)
      const resolvedPrev3 = activeTetragram.resolveToken(prev3)
      if (!resolvedPrev1 || !resolvedPrev2 || !resolvedPrev3) {
        return getNextTokenTrigram(baseTokens, fallbackTrigram, fallbackBigram)
      }
      const result = activeTetragram.getCandidatesForContext(
        resolvedPrev1,
        resolvedPrev2,
        resolvedPrev3,
      )
      const candidates = result ? result.candidates : []
      if (candidates.length === 0) {
        return getNextTokenTrigram(baseTokens, fallbackTrigram, fallbackBigram)
      }
      if (temperature <= 0) {
        return candidates[0].token
      }
      const adjusted = applyTemperature(
        candidates.map((candidate) => ({ token: candidate.token, prob: candidate.prob })),
        temperature,
      )
      const sampled = sampleCandidate(adjusted)
      return sampled ? sampled.token : null
    },
    [temperature, getNextTokenTrigram],
  )

  const computePredictedNext = useCallback(() => {
    if (modelType === 'tetragrams') {
      setPredictedContext(null)
      setPredictedTrigramContext(null)
      if (tetragramModel.isEmpty()) {
        setPredictedNext(null)
        setPredictedTetragramContext(null)
        setManualTetragramSelection(null)
        return
      }
      if (!resolvedTetPrev1 || !resolvedTetPrev2 || !resolvedTetPrev3) {
        setPredictedNext(null)
        setPredictedTetragramContext(null)
        return
      }
      if (
        manualTetragramSelection &&
        manualTetragramSelection.prev1 === resolvedTetPrev1 &&
        manualTetragramSelection.prev2 === resolvedTetPrev2 &&
        manualTetragramSelection.prev3 === resolvedTetPrev3
      ) {
        setPredictedNext(manualTetragramSelection.next)
        setPredictedTetragramContext({
          prev1: resolvedTetPrev1,
          prev2: resolvedTetPrev2,
          prev3: resolvedTetPrev3,
        })
        return
      }
      if (manualTetragramSelection) {
        setManualTetragramSelection(null)
      }
      const result = tetragramModel.getWeightedCandidatesForContext(
        resolvedTetPrev1,
        resolvedTetPrev2,
        resolvedTetPrev3,
        12,
      )
      const candidates = result ? result.candidates : []
      if (candidates.length === 0) {
        setPredictedNext(null)
        setPredictedTetragramContext(null)
        return
      }
      if (temperature <= 0) {
        setPredictedNext(candidates[0].token)
        setPredictedTetragramContext({
          prev1: result?.contexts[0]?.prev1 ?? resolvedTetPrev1,
          prev2: result?.contexts[0]?.prev2 ?? resolvedTetPrev2,
          prev3: result?.contexts[0]?.prev3 ?? resolvedTetPrev3,
        })
        return
      }
      const adjusted = applyTemperature(
        candidates.map((candidate) => ({ token: candidate.token, prob: candidate.prob })),
        temperature,
      )
      const sampled = sampleCandidate(adjusted)
      setPredictedNext(sampled ? sampled.token : null)
      setPredictedTetragramContext({
        prev1: result?.contexts[0]?.prev1 ?? resolvedTetPrev1,
        prev2: result?.contexts[0]?.prev2 ?? resolvedTetPrev2,
        prev3: result?.contexts[0]?.prev3 ?? resolvedTetPrev3,
      })
      return
    }

    if (modelType === 'trigrams') {
      setPredictedContext(null)
      setPredictedTetragramContext(null)
      if (trigramModel.isEmpty()) {
        setPredictedNext(null)
        setPredictedTrigramContext(null)
        setManualTrigramSelection(null)
        return
      }
      if (!resolvedTriPrev1 || !resolvedTriPrev2) {
        setPredictedNext(null)
        setPredictedTrigramContext(null)
        return
      }
      if (
        manualTrigramSelection &&
        manualTrigramSelection.prev1 === resolvedTriPrev1 &&
        manualTrigramSelection.prev2 === resolvedTriPrev2
      ) {
        setPredictedNext(manualTrigramSelection.next)
        setPredictedTrigramContext({ prev1: resolvedTriPrev1, prev2: resolvedTriPrev2 })
        return
      }
      if (manualTrigramSelection) {
        setManualTrigramSelection(null)
      }
      const result = trigramModel.getCandidatesForContext(resolvedTriPrev1, resolvedTriPrev2)
      const candidates = result ? result.candidates : []
      if (candidates.length === 0) {
        setPredictedNext(null)
        setPredictedTrigramContext(null)
        return
      }
      if (temperature <= 0) {
        setPredictedNext(candidates[0].token)
        setPredictedTrigramContext({
          prev1: result?.prev1 ?? resolvedTriPrev1,
          prev2: result?.prev2 ?? resolvedTriPrev2,
        })
        return
      }
      const adjusted = applyTemperature(
        candidates.map((candidate) => ({ token: candidate.token, prob: candidate.prob })),
        temperature,
      )
      const sampled = sampleCandidate(adjusted)
      setPredictedNext(sampled ? sampled.token : null)
      setPredictedTrigramContext({
        prev1: result?.prev1 ?? resolvedTriPrev1,
        prev2: result?.prev2 ?? resolvedTriPrev2,
      })
      return
    }

    if (modelType !== 'bigrams') {
      setPredictedNext(null)
      setPredictedContext(null)
      return
    }

    setPredictedTrigramContext(null)

    if (bigramModel.isEmpty()) {
      setPredictedNext(null)
      setPredictedContext(null)
      setManualSelection(null)
      return
    }
    let context = currentToken
    if (!context) {
      context = bigramModel.getMostCommonToken()
    }
    if (!context) {
      setPredictedNext(null)
      setPredictedContext(null)
      setManualSelection(null)
      return
    }
    const resolved = bigramModel.resolveToken(context) ?? bigramModel.getMostCommonToken()
    if (!resolved) {
      setPredictedNext(null)
      setPredictedContext(null)
      setManualSelection(null)
      return
    }
    if (manualSelection && manualSelection.context === resolved) {
      setPredictedNext(manualSelection.next)
      setPredictedContext(resolved)
      return
    }
    if (manualSelection) {
      setManualSelection(null)
    }
    const candidates = bigramModel.getCandidates(resolved)
    if (candidates.length === 0) {
      setPredictedNext(null)
      setPredictedContext(null)
      return
    }
    if (temperature <= 0) {
      setPredictedNext(candidates[0].token)
      setPredictedContext(resolved)
      return
    }
    const adjusted = applyTemperature(
      candidates.map((candidate) => ({ token: candidate.token, prob: candidate.prob })),
      temperature,
    )
    const sampled = sampleCandidate(adjusted)
    setPredictedNext(sampled ? sampled.token : null)
    setPredictedContext(resolved)
  }, [
    bigramModel,
    currentToken,
    manualSelection,
    manualTrigramSelection,
    manualTetragramSelection,
    modelType,
    resolvedTriPrev1,
    resolvedTriPrev2,
    resolvedTetPrev1,
    resolvedTetPrev2,
    resolvedTetPrev3,
    temperature,
    tetragramModel,
    trigramModel,
  ])

  const handleBigramSelect = useCallback(
    (prev: string, next: string) => {
      setManualSelection({ context: prev, next })
      setPredictedContext(prev)
      setPredictedNext(next)
    },
    [],
  )

  const handleTrigramSelect = useCallback(
    (prev1: string, prev2: string, next: string) => {
      setManualTrigramSelection({ prev1, prev2, next })
      setPredictedTrigramContext({ prev1, prev2 })
      setPredictedNext(next)
    },
    [],
  )

  const handleTetragramSelect = useCallback(
    (prev1: string, prev2: string, prev3: string, next: string) => {
      setManualTetragramSelection({ prev1, prev2, prev3, next })
      setPredictedTetragramContext({ prev1, prev2, prev3 })
      setPredictedNext(next)
    },
    [],
  )

  const generateOne = useCallback(() => {
    const models = ensureModels()
    setGeneratedTokens((prev) => {
      const baseTokens = [...seedTokens, ...prev]
      let next: string | null
      if (modelType === 'bigrams') {
        const contextToken = baseTokens[baseTokens.length - 1]
        const resolved = contextToken
          ? models.bigram.resolveToken(contextToken) ?? models.bigram.getMostCommonToken()
          : models.bigram.getMostCommonToken()
        const usePredicted =
          predictedNext && predictedContext && resolved && predictedContext === resolved
        next = usePredicted
          ? predictedNext
          : getNextTokenBigram(baseTokens, models.bigram)
      } else if (modelType === 'trigrams') {
        const prev2 = baseTokens[baseTokens.length - 1]
        const prev1 = baseTokens[baseTokens.length - 2]
        const resolvedPrev1Local = prev1 ? models.trigram.resolveToken(prev1) : null
        const resolvedPrev2Local = prev2 ? models.trigram.resolveToken(prev2) : null
        const usePredicted =
          predictedNext &&
          predictedTrigramContext &&
          resolvedPrev1Local &&
          resolvedPrev2Local &&
          predictedTrigramContext.prev1 === resolvedPrev1Local &&
          predictedTrigramContext.prev2 === resolvedPrev2Local
        next = usePredicted
          ? predictedNext
          : getNextTokenTrigram(baseTokens, models.trigram, models.bigram)
      } else {
        const prev3 = baseTokens[baseTokens.length - 1]
        const prev2 = baseTokens[baseTokens.length - 2]
        const prev1 = baseTokens[baseTokens.length - 3]
        const resolvedPrev1Local = prev1 ? models.tetragram.resolveToken(prev1) : null
        const resolvedPrev2Local = prev2 ? models.tetragram.resolveToken(prev2) : null
        const resolvedPrev3Local = prev3 ? models.tetragram.resolveToken(prev3) : null
        const usePredicted =
          predictedNext &&
          predictedTetragramContext &&
          resolvedPrev1Local &&
          resolvedPrev2Local &&
          resolvedPrev3Local &&
          predictedTetragramContext.prev1 === resolvedPrev1Local &&
          predictedTetragramContext.prev2 === resolvedPrev2Local &&
          predictedTetragramContext.prev3 === resolvedPrev3Local
        next = usePredicted
          ? predictedNext
          : getNextTokenTetragram(
              baseTokens,
              models.tetragram,
              models.trigram,
              models.bigram,
            )
      }
      if (!next) return prev
      return [...prev, next]
    })
  }, [
    ensureModels,
    getNextTokenBigram,
    getNextTokenTrigram,
    getNextTokenTetragram,
    modelType,
    predictedNext,
    predictedContext,
    predictedTrigramContext,
    predictedTetragramContext,
    seedTokens,
  ])

  const generateMany = useCallback(
    (amount: number) => {
      const models = ensureModels()
      const nextTokens: string[] = []
      let currentTokens = [...seedTokens, ...generatedTokens]

      for (let i = 0; i < amount; i += 1) {
        const next = modelType === 'tetragrams'
          ? getNextTokenTetragram(
              currentTokens,
              models.tetragram,
              models.trigram,
              models.bigram,
            )
          : modelType === 'trigrams'
            ? getNextTokenTrigram(currentTokens, models.trigram, models.bigram)
            : getNextTokenBigram(currentTokens, models.bigram)
        if (!next) break
        nextTokens.push(next)
        currentTokens = [...currentTokens, next]
      }

      if (nextTokens.length > 0) {
        setGeneratedTokens((prev) => [...prev, ...nextTokens])
      }
    },
    [
      ensureModels,
      getNextTokenBigram,
      getNextTokenTrigram,
      getNextTokenTetragram,
      modelType,
      seedTokens,
      generatedTokens,
    ],
  )

  const startAnimation = useCallback(() => {
    stopAnimation()
    const models = ensureModels()
    const baseSeed = [...seedTokens]
    setIsAnimating(true)
    intervalRef.current = window.setInterval(() => {
      setGeneratedTokens((prev) => {
        const next = modelType === 'tetragrams'
          ? getNextTokenTetragram(
              [...baseSeed, ...prev],
              models.tetragram,
              models.trigram,
              models.bigram,
            )
          : modelType === 'trigrams'
            ? getNextTokenTrigram([...baseSeed, ...prev], models.trigram, models.bigram)
            : getNextTokenBigram([...baseSeed, ...prev], models.bigram)
        if (!next) {
          stopAnimation()
          return prev
        }
        return [...prev, next]
      })
    }, 200)
  }, [
    ensureModels,
    getNextTokenBigram,
    getNextTokenTrigram,
    getNextTokenTetragram,
    modelType,
    seedTokens,
    stopAnimation,
  ])

  const clearAll = useCallback(() => {
    stopAnimation()
    setSeedText('')
    setGeneratedTokens([])
    setTemperature(DEFAULT_TEMPERATURE)
    setFilterCurrentOnly(false)
    setModelType('bigrams')
  }, [stopAnimation])

  const loadCorpusText = useCallback(async (option: CorpusOption) => {
    if (option.text) {
      setCorpusText(stripFrontmatter(option.text))
      return
    }
    if (!option.file) return
    try {
      setIsLoadingCorpus(true)
      const response = await fetch(`${import.meta.env.BASE_URL}texts/${option.file}`)
      if (!response.ok) throw new Error('Failed to load corpus')
      const text = await response.text()
      setCorpusText(stripFrontmatter(text))
    } catch {
      setCorpusText('')
    } finally {
      setIsLoadingCorpus(false)
    }
  }, [])

  const handleCorpusChange = useCallback((value: string) => {
    setSelectedCorpusId('custom')
    setCorpusText(stripFrontmatter(value))
  }, [])

  const handleCorpusSelect = useCallback(
    (id: string) => {
      setSelectedCorpusId(id)
      if (id === 'custom') return
      const selected = corpusOptions.find((option) => option.id === id)
      if (selected) {
        void loadCorpusText(selected)
      }
    },
    [corpusOptions, loadCorpusText],
  )

  const loadManifest = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}texts/manifest.json`)
      if (!response.ok) throw new Error('Failed to load manifest')
      const data = (await response.json()) as { texts: CorpusManifestItem[] }
      const options = data.texts
        .filter((item) => item.language === 'ca')
        .map((item) => ({
        id: item.id,
          label: `${item.category} > ${item.title}`,
        file: item.file,
      }))
      const withCustom = [
        BASIC_CORPUS_OPTION,
        EXTENDED_CORPUS_OPTION,
        ...options,
        CUSTOM_CORPUS_OPTION,
      ]
      setCorpusOptions(withCustom)
      if (!selectedCorpusId) {
        setSelectedCorpusId(BASIC_CORPUS_OPTION.id)
        void loadCorpusText(BASIC_CORPUS_OPTION)
      }
    } catch {
      setCorpusOptions([BASIC_CORPUS_OPTION, EXTENDED_CORPUS_OPTION, CUSTOM_CORPUS_OPTION])
    }
  }, [loadCorpusText, selectedCorpusId])

  useEffect(() => {
    return () => stopAnimation()
  }, [stopAnimation])

  useEffect(() => {
    void loadManifest()
  }, [loadManifest])

  useEffect(() => {
    computePredictedNext()
  }, [computePredictedNext, seedText, generatedTokens, temperature, corpusText, modelType])

  const isCorpusTrained =
    lastTrainedCorpus === corpusText &&
    !bigramModel.isEmpty() &&
    !trigramModel.isEmpty() &&
    !tetragramModel.isEmpty()

  const closestTetragramContexts = useMemo(() => {
    if (modelType !== 'tetragrams') return []
    if (!resolvedTetPrev1 || !resolvedTetPrev2 || !resolvedTetPrev3) return []
    return tetragramModel.getClosestContexts(
      resolvedTetPrev1,
      resolvedTetPrev2,
      resolvedTetPrev3,
      12,
    )
  }, [modelType, resolvedTetPrev1, resolvedTetPrev2, resolvedTetPrev3, tetragramModel])

  return (
    <div className={`${styles.app} ${isPresentationMode ? styles.presentation : ''}`}>
      <div className={styles.layout}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderControls}>
              <button
                className={`${styles.presentationToggle} ${isPresentationMode ? styles.presentationToggleActive : ''}`}
                type="button"
                aria-label="Mode presentacio"
                aria-pressed={isPresentationMode}
                title="Mode presentacio"
                onClick={() => setIsPresentationMode((prev) => !prev)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                  <path d="M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0-2a8 8 0 1 0 5.32 14.02l4.33 4.33a1 1 0 0 0 1.42-1.42l-4.33-4.33A8 8 0 0 0 10 2z" />
                </svg>
              </button>
              <div className={styles.tabs}>
                <button
                  className={`${styles.tabButton} ${activeTab === 'corpus' ? styles.tabButtonActive : ''}`}
                  type="button"
                  onClick={() => setActiveTab('corpus')}
                >
                  Corpus
                </button>
                <button
                  className={`${styles.tabButton} ${activeTab === 'bigrams' ? styles.tabButtonActive : ''}`}
                  type="button"
                  onClick={() => setActiveTab('bigrams')}
                >
                  {modelType === 'tetragrams'
                    ? 'Tetragrames'
                    : modelType === 'trigrams'
                      ? 'Trigrames'
                      : 'Bigrames'}
                </button>
                <button
                  className={`${styles.tabButton} ${activeTab === 'context' ? styles.tabButtonActive : ''}`}
                  type="button"
                  onClick={() => setActiveTab('context')}
                >
                  Context
                </button>
              </div>
            </div>
            <span className={styles.sectionTitle}>Entrenament</span>
          </div>

          <div className={styles.panelBody}>
            {activeTab === 'corpus' ? (
              <CorpusTab
                corpusText={corpusText}
                corpusOptions={corpusOptions}
                selectedCorpusId={selectedCorpusId}
                onCorpusSelect={handleCorpusSelect}
                onCorpusChange={handleCorpusChange}
                onTrain={trainModel}
                isTrained={isCorpusTrained}
                isLoading={isLoadingCorpus}
              />
            ) : activeTab === 'context' ? (
              <ContextView fragment={contextFragment} />
            ) : modelType === 'tetragrams' ? (
              <TetragramList
                tetragrams={tetragrams}
                currentPrev1={resolvedTetPrev1}
                currentPrev2={resolvedTetPrev2}
                currentPrev3={resolvedTetPrev3}
                predictedNext={predictedNext}
                filterCurrentOnly={filterCurrentOnly}
                onToggleFilter={setFilterCurrentOnly}
                onSelectTetragram={handleTetragramSelect}
                closestContexts={closestTetragramContexts}
              />
            ) : modelType === 'trigrams' ? (
              <TrigramList
                trigrams={trigrams}
                currentPrev1={resolvedTriPrev1}
                currentPrev2={resolvedTriPrev2}
                predictedNext={predictedNext}
                filterCurrentOnly={filterCurrentOnly}
                onToggleFilter={setFilterCurrentOnly}
                onSelectTrigram={handleTrigramSelect}
              />
            ) : (
              <BigramList
                bigrams={bigrams}
                currentToken={resolvedToken ?? currentToken}
                predictedNext={predictedNext}
                filterCurrentOnly={filterCurrentOnly}
                onToggleFilter={setFilterCurrentOnly}
                onSelectBigram={handleBigramSelect}
              />
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <GeneratorControls
            modelType={modelType}
            seedText={seedText}
            temperature={temperature}
            isAnimating={isAnimating}
            onModelChange={setModelType}
            onSeedChange={handleSeedChange}
            onTemperatureChange={setTemperature}
            onGenerate10={() => generateMany(10)}
            onGenerate50={() => generateMany(50)}
            onGenerateAnimated={startAnimation}
            onStep={generateOne}
            onStop={stopAnimation}
            onClear={clearAll}
          />

          <div className={styles.generatedSection}>
            <h3 className={styles.sectionTitle}>Text generat</h3>
            <GeneratedText text={outputText} />
          </div>
        </section>
      </div>
    </div>
  )
}

export default App

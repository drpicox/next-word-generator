import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './App.module.css'
import { BigramModel } from './models/BigramModel'
import type { BigramEntry } from './models/BigramModel'
import { normalizeText } from './utils/normalize'
import { tokenize } from './utils/tokenize'
import { tokensToText } from './utils/format'
import { applyTemperature, sampleCandidate } from './utils/sample'
import { CorpusTab } from './components/CorpusTab'
import { BigramList } from './components/BigramList'
import { GeneratorControls } from './components/GeneratorControls'
import { GeneratedText } from './components/GeneratedText'

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
  const [model, setModel] = useState(() => new BigramModel())
  const [bigrams, setBigrams] = useState<BigramEntry[]>([])
  const [seedText, setSeedText] = useState('')
  const [generatedTokens, setGeneratedTokens] = useState<string[]>([])
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE)
  const [activeTab, setActiveTab] = useState<'corpus' | 'bigrams'>('corpus')
  const [filterCurrentOnly, setFilterCurrentOnly] = useState(false)
  const [modelType, setModelType] = useState('bigrams')
  const [isAnimating, setIsAnimating] = useState(false)
  const [predictedNext, setPredictedNext] = useState<string | null>(null)
  const [predictedContext, setPredictedContext] = useState<string | null>(null)
  const [manualSelection, setManualSelection] = useState<{
    context: string
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
  const resolvedToken = currentToken ? model.resolveToken(currentToken) : null

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
    const trained = new BigramModel()
    trained.train(corpusText)
    setModel(trained)
    setBigrams(trained.getAllBigrams())
    setLastTrainedCorpus(corpusText)
  }, [corpusText])

  const ensureModel = useCallback(() => {
    if (!model.isEmpty()) return model
    const trained = new BigramModel()
    trained.train(corpusText)
    setModel(trained)
    setBigrams(trained.getAllBigrams())
    setLastTrainedCorpus(corpusText)
    return trained
  }, [model, corpusText])

  const getNextToken = useCallback(
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

  const computePredictedNext = useCallback(() => {
    if (model.isEmpty()) {
      setPredictedNext(null)
      setPredictedContext(null)
      setManualSelection(null)
      return
    }
    let context = currentToken
    if (!context) {
      context = model.getMostCommonToken()
    }
    if (!context) {
      setPredictedNext(null)
      setPredictedContext(null)
      setManualSelection(null)
      return
    }
    const resolved = model.resolveToken(context) ?? model.getMostCommonToken()
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
    const candidates = model.getCandidates(resolved)
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
  }, [model, currentToken, temperature])

  const handleBigramSelect = useCallback(
    (prev: string, next: string) => {
      setManualSelection({ context: prev, next })
      setPredictedContext(prev)
      setPredictedNext(next)
    },
    [],
  )

  const generateOne = useCallback(() => {
    const activeModel = ensureModel()
    if (activeModel.isEmpty()) return
    setGeneratedTokens((prev) => {
      const baseTokens = [...seedTokens, ...prev]
      const contextToken = baseTokens[baseTokens.length - 1]
      const resolved = contextToken
        ? activeModel.resolveToken(contextToken) ?? activeModel.getMostCommonToken()
        : activeModel.getMostCommonToken()
      const shouldUsePredicted =
        predictedNext && predictedContext && resolved && predictedContext === resolved
      const next = shouldUsePredicted
        ? predictedNext
        : getNextToken(baseTokens, activeModel)
      if (!next) return prev
      return [...prev, next]
    })
  }, [ensureModel, getNextToken, predictedNext, predictedContext, seedTokens])

  const generateMany = useCallback(
    (amount: number) => {
      const activeModel = ensureModel()
      if (activeModel.isEmpty()) return
      const nextTokens: string[] = []
      let currentTokens = [...seedTokens, ...generatedTokens]

      for (let i = 0; i < amount; i += 1) {
        const next = getNextToken(currentTokens, activeModel)
        if (!next) break
        nextTokens.push(next)
        currentTokens = [...currentTokens, next]
      }

      if (nextTokens.length > 0) {
        setGeneratedTokens((prev) => [...prev, ...nextTokens])
      }
    },
    [ensureModel, getNextToken, seedTokens, generatedTokens],
  )

  const startAnimation = useCallback(() => {
    stopAnimation()
    const activeModel = ensureModel()
    if (activeModel.isEmpty()) return
    const baseSeed = [...seedTokens]
    setIsAnimating(true)
    intervalRef.current = window.setInterval(() => {
      setGeneratedTokens((prev) => {
        const next = getNextToken([...baseSeed, ...prev], activeModel)
        if (!next) {
          stopAnimation()
          return prev
        }
        return [...prev, next]
      })
    }, 200)
  }, [ensureModel, getNextToken, seedTokens, stopAnimation])

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
      const response = await fetch(`/texts/${option.file}`)
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
      const response = await fetch('/texts/manifest.json')
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
  }, [computePredictedNext, seedText, generatedTokens, temperature, corpusText])

  const isCorpusTrained = lastTrainedCorpus === corpusText && !model.isEmpty()

  return (
    <div className={styles.app}>
      <div className={styles.layout}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
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
                Bigrames
              </button>
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

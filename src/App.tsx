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

const DEFAULT_CORPUS =
  'el gat està content. el gos és feliç. el gat dorm. el gos juga. el gat menja. el gos corre. el cotxe és ràpid. el cotxe va lluny.'

const EXTENDED_CORPUS =
  `la pluja cau lenta. el sol surt a poc a poc. la nena llegeix un llibre. el noi escriu una carta. la ciutat dorm però el tren passa. el carrer és buit i tranquil. el vent porta olor de mar. el matí arriba amb calma. la pluja es fa fina i el vent baixa. el sol torna i la ciutat es desperta. la nena guarda el llibre i somriu. el noi llegeix la carta i respira. el tren arriba tard però passa de pressa. el carrer queda buit i el silenci dura. el mar és calmat i l'olor és dolça. la calma del matí es queda una estona.`

const CORPUS_OPTIONS = [
  { id: 'basic', label: 'Corpus bàsic', text: DEFAULT_CORPUS },
  { id: 'extended', label: 'Corpus ampliat', text: EXTENDED_CORPUS },
  { id: 'custom', label: 'Personalitzat', text: '' },
]

const DEFAULT_TEMPERATURE = 0.7

function App() {
  const [corpusText, setCorpusText] = useState(DEFAULT_CORPUS)
  const [selectedCorpusId, setSelectedCorpusId] = useState('basic')
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

  const generateOne = useCallback(() => {
    const activeModel = ensureModel()
    if (activeModel.isEmpty()) return
    setGeneratedTokens((prev) => {
      const next = getNextToken([...seedTokens, ...prev], activeModel)
      if (!next) return prev
      return [...prev, next]
    })
  }, [ensureModel, getNextToken, seedTokens])

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

  const handleCorpusChange = useCallback((value: string) => {
    setSelectedCorpusId('custom')
    setCorpusText(value)
  }, [])

  const handleCorpusSelect = useCallback((id: string) => {
    setSelectedCorpusId(id)
    const selected = CORPUS_OPTIONS.find((option) => option.id === id)
    if (selected && selected.id !== 'custom') {
      setCorpusText(selected.text)
    }
  }, [])

  useEffect(() => {
    return () => stopAnimation()
  }, [stopAnimation])

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
                corpusOptions={CORPUS_OPTIONS}
                selectedCorpusId={selectedCorpusId}
                onCorpusSelect={handleCorpusSelect}
                onCorpusChange={handleCorpusChange}
                onTrain={trainModel}
                isTrained={isCorpusTrained}
              />
            ) : (
              <BigramList
                bigrams={bigrams}
                currentToken={resolvedToken ?? currentToken}
                filterCurrentOnly={filterCurrentOnly}
                onToggleFilter={setFilterCurrentOnly}
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

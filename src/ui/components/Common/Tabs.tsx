interface TabsProps {
  tabs: { key: string; label: string }[]
  active: string
  onChange: (key: string) => void
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="-mx-4 mb-6 overflow-x-auto px-4">
      <div className="flex w-max min-w-full gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`min-h-10 shrink-0 px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${
              active === tab.key
                ? 'bg-card text-foreground border border-b-card border-border -mb-px'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

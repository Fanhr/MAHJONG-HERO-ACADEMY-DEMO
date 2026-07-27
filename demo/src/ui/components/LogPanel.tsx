export interface LogItem {
  seq: number;
  type: string;
  text: string;
}

const TYPE_COLOR: Record<string, string> = {
  damage: 'text-alert',
  'skill-damage': 'text-orange-400',
  eliminate: 'text-rose-500 font-bold',
  'game-over': 'text-gold font-bold',
  skill: 'text-sky-300',
  card: 'text-emerald-300',
  dingque: 'text-orange-300',
  'round-start': 'text-muted',
  exhaust: 'text-muted',
};

export default function LogPanel({ items }: { items: LogItem[] }) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="mb-2 text-xs font-semibold text-gold">战报</div>
      <div className="scroll-slim flex max-h-48 flex-col-reverse gap-1 overflow-y-auto text-[12px] leading-relaxed">
        {[...items].reverse().map((e) => (
          <div key={e.seq} className={TYPE_COLOR[e.type] ?? 'text-muted'}>
            {e.text}
          </div>
        ))}
      </div>
    </div>
  );
}

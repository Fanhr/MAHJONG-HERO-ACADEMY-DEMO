import { useGame } from './store';
import HeroSelect from './screens/HeroSelect';
import Briefing from './screens/Briefing';
import Battle from './screens/Battle';
import Result from './screens/Result';
import ErrorBoundary from './ErrorBoundary';

export default function App() {
  const screen = useGame((s) => s.screen);
  return (
    <div className="min-h-full font-sans text-parchment">
      <ErrorBoundary>
        {screen === 'select' && <HeroSelect />}
        {screen === 'briefing' && <Briefing />}
        {screen === 'battle' && <Battle />}
        {screen === 'result' && <Result />}
      </ErrorBoundary>
    </div>
  );
}

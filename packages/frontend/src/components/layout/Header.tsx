import { Link } from 'react-router-dom';

export function Header() {
  return (
    <header className="bg-slate-800 border-b border-slate-700">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-primary-500">
            Deployy Panel
          </Link>
          <nav className="flex gap-6">
            <Link to="/" className="text-slate-300 hover:text-white transition-colors">
              Dashboard
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

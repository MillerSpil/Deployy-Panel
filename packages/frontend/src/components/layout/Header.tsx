import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { Button } from '../common/Button';
import logo from '../../assets/logo.svg';

export function Header() {
  const { user, logout } = useAuth();
  const { canAccessAdmin, canManageUsers, canManageRoles } = usePermissions();
  const navigate = useNavigate();
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-slate-800 border-b border-slate-700">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 text-xl sm:text-2xl font-bold text-primary-500">
            <img src={logo} alt="Deployy" className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg" />
            <span className="hidden xs:inline">Deployy Panel</span>
            <span className="xs:hidden">Deployy</span>
          </Link>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-slate-300 hover:text-white"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-slate-300 hover:text-white transition-colors">
              Dashboard
            </Link>
            {canAccessAdmin && (
              <div className="relative">
                <button
                  onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  Admin
                </button>
                {isAdminMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsAdminMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-20">
                      {canManageUsers && (
                        <Link
                          to="/admin/users"
                          className="block px-4 py-2 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                          onClick={() => setIsAdminMenuOpen(false)}
                        >
                          Users
                        </Link>
                      )}
                      {canManageRoles && (
                        <Link
                          to="/admin/roles"
                          className="block px-4 py-2 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                          onClick={() => setIsAdminMenuOpen(false)}
                        >
                          Roles
                        </Link>
                      )}
                      <Link
                        to="/admin/settings"
                        className="block px-4 py-2 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                        onClick={() => setIsAdminMenuOpen(false)}
                      >
                        Settings
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}
            {user && (
              <>
                <span className="text-slate-400 text-sm">
                  {user.email}
                  {user.roleName && (
                    <span className="ml-2 text-xs text-primary-400">({user.roleName})</span>
                  )}
                </span>
                <Button variant="secondary" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            )}
          </nav>
        </div>

        {/* Mobile navigation */}
        {isMobileMenuOpen && (
          <nav className="md:hidden mt-4 pt-4 border-t border-slate-700">
            <div className="flex flex-col gap-3">
              <Link
                to="/"
                className="text-slate-300 hover:text-white transition-colors py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              {canAccessAdmin && (
                <>
                  {canManageUsers && (
                    <Link
                      to="/admin/users"
                      className="text-slate-300 hover:text-white transition-colors py-2"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Admin → Users
                    </Link>
                  )}
                  {canManageRoles && (
                    <Link
                      to="/admin/roles"
                      className="text-slate-300 hover:text-white transition-colors py-2"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Admin → Roles
                    </Link>
                  )}
                  <Link
                    to="/admin/settings"
                    className="text-slate-300 hover:text-white transition-colors py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Admin → Settings
                  </Link>
                </>
              )}
              {user && (
                <div className="pt-3 border-t border-slate-700">
                  <p className="text-slate-400 text-sm mb-3">
                    {user.email}
                    {user.roleName && (
                      <span className="ml-2 text-xs text-primary-400">({user.roleName})</span>
                    )}
                  </p>
                  <Button variant="secondary" onClick={handleLogout} className="w-full">
                    Logout
                  </Button>
                </div>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

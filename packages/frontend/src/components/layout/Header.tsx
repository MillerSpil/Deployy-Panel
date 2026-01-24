import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { Button } from '../common/Button';

export function Header() {
  const { user, logout } = useAuth();
  const { canAccessAdmin, canManageUsers, canManageRoles } = usePermissions();
  const navigate = useNavigate();
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-slate-800 border-b border-slate-700">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-primary-500">
            Deployy Panel
          </Link>
          <nav className="flex items-center gap-6">
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
      </div>
    </header>
  );
}

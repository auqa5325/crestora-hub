import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'judge' | 'clubs' | 'student';
  requiredRoles?: ('admin' | 'judge' | 'clubs' | 'student')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, requiredRoles }) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role access
  const hasAccess = () => {
    if (!requiredRole && !requiredRoles) return true;
    
    if (requiredRole) {
      return user?.role === requiredRole;
    }
    
    if (requiredRoles) {
      return user?.role && requiredRoles.includes(user.role);
    }
    
    return false;
  };

  if (!hasAccess()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ak-success-crm-secret-key-2024';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

export function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      can_approve: user.can_approve === 1 || user.can_approve === true
    },
    JWT_SECRET,
    // No expiry (no `exp` claim). Users stay logged in until JWT_SECRET rotates or token is revoked externally.
    {}
  );
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // CEO and admin have access to everything
    if (req.user.role === 'ceo' || req.user.role === 'admin') {
      return next();
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

export function requireApproval(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Check if user has approval permissions
  if (req.user.can_approve === 1 || req.user.can_approve === true) {
    return next();
  }
  
  return res.status(403).json({ error: 'You do not have approval permissions' });
}

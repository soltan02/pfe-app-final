



const ROLE_LEVELS = {
  agent: 1,
  chef_equipe: 2,
  admin: 3
};

module.exports = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const userLevel = ROLE_LEVELS[req.user.role] || 0;
    const allowed = roles.some(r => userLevel >= (ROLE_LEVELS[r] || 0));

    if (!allowed) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    next();
  };
};

// Strict role check: requires an exact role match (no level hierarchy).
// Used for routes where the higher-level admin must NOT have access
// (e.g. attendance recording, which is a chef-only operation).
module.exports.exact = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    next();
  };
};


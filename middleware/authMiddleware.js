const jwt = require("jsonwebtoken");

/**
 * Middleware to protect routes by verifying the JWT token.
 * It decodes the token and attaches the user payload to req.user.
 */
const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required: No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Verify the token and attach its payload (id, email, role, isSuperAdmin) to the request
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

/**
 * Middleware to restrict access to a single, specific role.
 * @param {string} role - The role to allow (e.g., 'admin').
 */
const restrictTo = (role) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: `Forbidden: Access is restricted to ${role} role only.` });
    }
    next();
  };
};

/**
 * Middleware to restrict access to a list of allowed roles.
 * @param  {...string} roles - A list of roles to allow (e.g., 'admin', 'manager').
 */
const restrictToRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: You do not have the required role to access this resource." });
    }
    next();
  };
};

/**
 * ADDED: Middleware to restrict access to super admins only.
 * It checks for the 'isSuperAdmin' flag in the user payload.
 */
const restrictToSuperAdmin = (req, res, next) => {
  // This middleware should run *after* the 'protect' middleware.
  if (!req.user || !req.user.isSuperAdmin) {
    return res.status(403).json({
      message: "Forbidden: This action is restricted to super admins only.",
    });
  }
  next();
};


// MODIFIED: Export the new function
module.exports = { protect, restrictTo, restrictToRoles, restrictToSuperAdmin };

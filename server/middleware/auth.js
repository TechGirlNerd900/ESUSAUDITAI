const { supabase } = require('../shared/supabaseClient');
const AuthService = require('../shared/auth');
const SecurityService = require('../shared/security');
const { applicationInsights } = require('../shared/logging');

const auth = new AuthService();
const security = new SecurityService();

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }
    
    try {
      const token = auth.extractTokenFromHeader(authHeader);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        throw new Error('Invalid token');
      }

      // Get additional user data from Supabase
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, role, company')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;
      
      req.user = {
        id: userData.id,
        email: userData.email,
        role: userData.role,
        firstName: userData.first_name,
        lastName: userData.last_name,
        company: userData.company
      };
      
      applicationInsights.trackEvent({
        name: 'UserAuthenticated',
        properties: {
          userId: userData.id,
          role: userData.role
        }
      });
      
      next();
    } catch (error) {
      applicationInsights.trackEvent({
        name: 'AuthenticationFailed',
        properties: { error: error.message }
      });
      return res.status(401).json({ error: 'Authentication failed' });
    }
  } catch (error) {
    applicationInsights.trackException({ exception: error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const canAccessProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
      
    if (error) throw error;
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!auth.canAccessProject(req.user, project)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    req.project = project;
    next();
  } catch (error) {
    applicationInsights.trackException({ exception: error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  authenticateToken,
  canAccessProject
};

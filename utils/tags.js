const TAGS = ['tech', 'development', 'hack', 'trick', 'question', 'exploit', 'cve', 'ctf', 'event', 'security', 'tools',
  'tutorial', 'project', 'showcase', 'news', 'career', 'webdev', 'ai', 'linux', 'malware', 'osint', 'networking',
  'reverse-engineering', 'bugbounty', 'crypto', 'mobile', 'cloud', 'devops', 'data', 'general'];

// Job/role - tags the feed should favour a little
const JOBS = {
  'Student': ['question', 'tutorial', 'career', 'general'],
  'Software Engineer': ['development', 'webdev', 'tools', 'project'],
  'Data Engineer': ['data', 'cloud', 'tools', 'ai'],
  'Data Scientist': ['data', 'ai', 'project'],
  'Security Researcher': ['exploit', 'cve', 'security', 'malware', 'reverse-engineering'],
  'Pentester': ['hack', 'exploit', 'ctf', 'bugbounty', 'tools'],
  'DevOps / SRE': ['devops', 'cloud', 'linux', 'networking'],
  'Hobbyist': ['trick', 'showcase', 'project', 'tech'],
  'Other': []
};
module.exports = { TAGS, JOBS };

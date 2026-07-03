// Shared navigation constants used across Student and Admin layouts

export interface NavItem {
  icon: string;
  label: string;
  path: string;
}

export const STUDENT_NAV_TABS: NavItem[] = [
  { icon: '🏠', label: 'Home', path: '/dashboard' },
  { icon: '♟', label: 'Play', path: '/play' },
  { icon: '🧩', label: 'Puzzles 🔒', path: '/features' },
  { icon: '📚', label: 'Learn', path: '/lessons' },
  { icon: '🏆', label: 'Games Library', path: '/games-library' },
  { icon: '📋', label: 'PGN Viewer', path: '/pgn-load' },
];

export const STUDENT_DROPDOWN_LINKS: NavItem[] = [
  { icon: '🏆', label: 'Games Library', path: '/games-library' },
  { icon: '📋', label: 'PGN Viewer', path: '/pgn-load' },
  { icon: '👤', label: 'My Profile', path: '/profile' },
];

export const ADMIN_NAV: NavItem[] = [
  { icon: '📊', label: 'Dashboard',     path: '/admin' },
  { icon: '👥', label: 'Students',      path: '/students' },
  { icon: '🏢', label: 'Organizations', path: '/organizations' },
  // { icon: '📍', label: 'District Activity', path: '/district-activity' },
  // { icon: '📄', label: 'Renewal Reports',   path: '/renewal-report' },
];

// Compact nav for admin mobile bottom bar (limited to 5 key items)
export const ADMIN_BOTTOM_NAV: NavItem[] = [
  { icon: '📊', label: 'Dashboard',     path: '/admin' },
  { icon: '👥', label: 'Students',      path: '/students' },
  { icon: '🏢', label: 'Orgs',          path: '/organizations' },
  // { icon: '📍', label: 'Activity',      path: '/district-activity' },
  // { icon: '📄', label: 'Reports',       path: '/renewal-report' },
];

export const MANAGER_NAV: NavItem[] = [
  { icon: '🏠', label: 'Dashboard',        path: '/campus' },
  { icon: '👥', label: 'My Students',      path: '/students' },
  { icon: '📍', label: 'Bootcamp Activity', path: '/bootcamp' },
  { icon: '🏆', label: 'Leaderboard',      path: '/leaderboard' },
  // { icon: '📄', label: 'Reports',          path: '/renewal-report' },
];

export const MANAGER_BOTTOM_NAV: NavItem[] = [
  { icon: '🏠', label: 'Dashboard', path: '/campus' },
  { icon: '👥', label: 'Students',  path: '/students' },
  { icon: '📍', label: 'Bootcamp',  path: '/bootcamp' },
  { icon: '🏆', label: 'Leaders',   path: '/leaderboard' },
  // { icon: '📄', label: 'Reports',   path: '/renewal-report' },
];

export const DISTRICTS = [
  'All Districts',
  'Chennai',
  'Coimbatore',
  'Madurai',
  'Salem',
  'Trichy',
  'Thanjavur',
];

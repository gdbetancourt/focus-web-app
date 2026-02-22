/**
 * Contact Sheet Components Index
 * 
 * This directory contains components extracted from the main ContactSheet.jsx
 * to improve maintainability and reduce file size.
 * 
 * REFACTORING STATUS:
 * - [x] constants.js - Shared constants (country codes, salutations, etc.)
 * - [x] ContactInputs.jsx - PhoneInput, EmailInput components
 * - [x] WebinarHistoryList.jsx - Webinar participation display
 * - [x] CoursesList.jsx - Course enrollments display
 * - [x] CaseHistoryList.jsx - Case associations display
 * - [x] CoursesTab.jsx - Full courses tab with enrollment (NEW)
 * - [x] CasesTab.jsx - Full cases tab with create/add (NEW)
 * - [ ] ContactInfoTab.jsx - Basic contact information form (TODO: needs state refactor)
 * - [ ] ContactCompaniesTab.jsx - Company associations (TODO: needs state refactor)
 * - [ ] ContactRelationshipsTab.jsx - Contact relationships (TODO: needs state refactor)
 * 
 * Main component: ContactSheet.jsx (in parent directory)
 * These extracted components are presentational and receive data via props.
 */

// Constants
export * from './constants';

// Input components
export { PhoneInput, EmailInput } from './ContactInputs';

// List components (presentational)
export { WebinarHistoryList } from './WebinarHistoryList';
export { CoursesList } from './CoursesList';
export { CaseHistoryList } from './CaseHistoryList';

// Full tab components (stateful)
export { CoursesTab } from './CoursesTab';
export { CasesTab } from './CasesTab';
export { WebinarsTab } from './WebinarsTab';
export { TasksTab } from './TasksTab';

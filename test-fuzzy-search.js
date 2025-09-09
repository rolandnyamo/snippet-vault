#!/usr/bin/env node

// Quick test script to demonstrate fuzzy search functionality
// This shows how the new search handles variations like "resource type" vs "resourceType"

function normalizeForSearch(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '') // Remove all spaces
    .replace(/[_-]/g, '') // Remove underscores and hyphens
    .trim();
}

function createSearchPatterns(query) {
  const normalized = normalizeForSearch(query);
  const patterns = [
    // Exact match (original behavior)
    query.toLowerCase(),
    // Normalized match (no spaces/underscores/hyphens)
    normalized,
    // Split into words and match each
    ...query.toLowerCase().split(/\s+/).filter(word => word.length > 1)
  ];
  
  return [...new Set(patterns)]; // Remove duplicates
}

// Test cases showing search improvement
console.log('🔍 Fuzzy Search Pattern Generation Test\n');

const testQueries = [
  'resource type',
  'resourceType', 
  'resour ce Type',
  'user-profile',
  'user_profile',
  'user profile',
  'API endpoint',
  'database connection'
];

testQueries.forEach(query => {
  console.log(`Query: "${query}"`);
  const patterns = createSearchPatterns(query);
  console.log(`Patterns: [${patterns.map(p => `"${p}"`).join(', ')}]`);
  console.log(`Normalized: "${normalizeForSearch(query)}"`);
  console.log('---');
});

console.log('\n✅ This shows how the fuzzy search now generates multiple patterns');
console.log('   to match variations like "resource type" and "resourceType"');

// Show SQL pattern matching examples
console.log('\n🎯 Example SQL matches that would now work:\n');

const examples = [
  {
    search: 'resource type',
    wouldMatch: ['resourceType field', 'resource_type variable', 'RESOURCE TYPE constant', 'resour ce Type (with typo)']
  },
  {
    search: 'user profile',
    wouldMatch: ['userProfile object', 'user-profile component', 'USER_PROFILE table', 'user profile data']
  }
];

examples.forEach(({search, wouldMatch}) => {
  console.log(`Searching for: "${search}"`);
  console.log('Would now match:');
  wouldMatch.forEach(match => console.log(`  ✓ "${match}"`));
  console.log('');
});

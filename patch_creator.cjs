const fs = require('fs');
let code = fs.readFileSync('src/features/dashboard/DashboardView.tsx', 'utf8');

if (!code.includes('const deferredCreatorFilter = useDebounce(creatorFilter, 300);')) {
  code = code.replace(
    /const deferredCollectionSearchQuery = useDebounce\(collectionSearchQuery, 300\);/,
    'const deferredCollectionSearchQuery = useDebounce(collectionSearchQuery, 300);\n    const deferredCreatorFilter = useDebounce(creatorFilter || "", 300);'
  );
  
  // replace creatorFilter with deferredCreatorFilter in filteredPosts
  code = code.replace(/if \(creatorFilter\) \{/g, 'if (deferredCreatorFilter) {');
  code = code.replace(/\.includes\(creatorFilter\.toLowerCase\(\)\)/g, '.includes(deferredCreatorFilter.toLowerCase())');
  
  // Update dependencies
  code = code.replace(/creatorFilter,/g, 'deferredCreatorFilter,');
  
  fs.writeFileSync('src/features/dashboard/DashboardView.tsx', code);
}

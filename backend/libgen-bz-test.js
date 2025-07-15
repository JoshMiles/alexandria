const { searchAndFetchLibgenPlus } = require('./libgen-bz');

(async () => {
  const query = 'warbreaker';
  console.log(`Searching libgen.bz for: ${query}`);
  const results = await searchAndFetchLibgenPlus(query);
  console.log(JSON.stringify(results, null, 2));
})(); 
# Ballotbox

A ballot system.

## How to use

1. Configure 'back.js' and 'front.js'.
2. Hit the following commands in a shell.

```
% cd ${your_path}
% sqlite3 -init _.sql _.db .tables;
% deno run --allow-net --allow-read=_.db,_.db-journal,www-back/ --allow-write=_.db,_.db-journal back.js
% deno run --allow-net --allow-read=_.db,_.db-journal,www-front/ --allow-write=_.db,_.db-journal front.js
```


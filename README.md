# Ballotbox

A ballot system.

## How to use

1. ```cp config.sample.js config.js```
1. Configure 'config.js'.
1. Hit the following commands in a shell.

```
% cd ${your_path}
% sqlite3 -init _.sql _.db .tables;
% deno run --allow-net --allow-read=. --allow-write=. back.js
% deno run --allow-net --allow-read=. --allow-write=. front.js
```


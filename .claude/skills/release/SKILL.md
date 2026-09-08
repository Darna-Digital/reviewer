---
name: release
description: Invoke when user asks to relase a new version.
---

1. check the current version in root package.json
2. update the version in root package.json by one increment, so let's say from `1.0.0` to `1.0.1`, based on the current version
3. commit the changes to root package.json
4. push the changes to main branch, then merge main to staging and merge staging to development

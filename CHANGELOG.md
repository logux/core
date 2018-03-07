# Change Log
This project adheres to [Semantic Versioning](http://semver.org/).

## 0.2.2
* Allow to set `meta.keepLast` in `preadd` event listener.

## 0.2.1
* Fix removing action with different `time` from memory store.

## 0.2
* Rename `meta.created` to `meta.id`.
* Rename `event` event to `add`.
* Use reasons of life API to clean log.
* Return new action `meta` in `Log#add`.
* Deny tab symbol in Node ID.
* Add `preadd` event.
* Add `TestTime`.
* Add `keepLast` option to `Log#add` (by Igor Deryabin).
* Add `meta.time` for `fixTime` feature.
* Add `isFirstOlder()` helper.
* Add `changeMeta`, `removeReason` and `byId` to store.
* Add `getLastAdded`, `getLastSynced` and `setLastSynced` method to store.
* Fix leap second problem.
* Move store tests to separated project (by Konstantin Mamaev).
* Fix docs (by Grigoriy Beziuk, Andrew Romanov and Alexey Gaziev).

## 0.1
* Initial release.

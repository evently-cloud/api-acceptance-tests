Feature: Selectors
  Test the different types of selectors

  Background: Set up data for tests
    Given Ledger has been created
    And Admin Client resets ledger
    And Registrar Client registers event 'Match Started' in entity 'Tennis Match'
    And Registrar Client registers event 'Ball Served' in entity 'Tennis Match'
    And Registrar Client registers event 'Ball Returned' in entity 'Tennis Match'
    And Registrar Client registers event 'Ball Out' in entity 'Tennis Match'
    Then Authenticated Client appends facts
      | entity        | event         | key         | meta            | data                          |
      | Tennis Match  | Match Started | 2023-01-07  | {"command": 1}  | {"players": ["Kal", "Char"]}  |
      | Tennis Match  | Ball Served   | 2023-01-07  | {"command": 2}  | {"player": "Kal"}             |
      | Tennis Match  | Ball Returned | 2023-01-07  | {"command": 3}  | {"player": "Char"}            |
      | Tennis Match  | Ball Returned | 2023-01-07  | {"command": 4}  | {"player": "Kal"}             |
      | Tennis Match  | Ball Out      | 2023-01-07  | {"command": 5}  | {"player": "Char"}            |
      | Tennis Match  | Match Started | 2023-01-09  | {"command": 6}  | {"players": ["Jer", "Char"]}  |
      | Tennis Match  | Ball Served   | 2023-01-09  | {"command": 7}  | {"player": "Char"}            |
      | Tennis Match  | Ball Returned | 2023-01-09  | {"command": 8}  | {"player": "Jer"}             |
      | Tennis Match  | Ball Out      | 2023-01-09  | {"command": 9}  | {"player": "Char"}            |


  Scenario: Replay all Tennis Match Events
    Given Authenticated Client replays all events for 'Tennis Match', keys '2023-01-07, 2023-01-09'
    Then Event count is 9

  Scenario: Replay only some Tennis Match Events for one match
    Given Authenticated Client replays 'Ball Returned' events for 'Tennis Match', keys '2023-01-07'
    Then Event count is 2

  Scenario: Replay only some Tennis Match Events for one match
    Given Authenticated Client replays 'Ball Returned, Ball Out' events for 'Tennis Match', keys '2023-01-07, 2023-01-09'
    Then Event count is 5

  Scenario: Replay Events after a known Event
    Given Authenticated Client replays 'Match Started' events for 'Tennis Match', keys '2023-01-09'
    And remembers selector
    When Authenticated Client replays all 'Tennis Match' events, key '2023-01-09' after remembered selector mark
    Then Event count is 3
    And last Event is 'Ball Out'

  Scenario: Replay limited number of Events
    Given Authenticated Client replays 5 'Ball Served, Ball Returned, Ball Out' events from 'Tennis Match', keys '2023-01-07, 2023-01-09'
    Then Event count is 5
    And last Event is 'Ball Served'


  Scenario: Replay limited number of events after a known Event
    Given Authenticated Client replays 'Ball Served' events for 'Tennis Match', keys '2023-01-07'
    And remembers selector
    When Authenticated Client replays, after remembered selector mark, 5 'Ball Served, Ball Returned, Ball Out' events from 'Tennis Match', keys '2023-01-07, 2023-01-09'
    Then Event count is 5
    And last Event is 'Ball Returned'

  Scenario: Select all events with meta filter
    ## No way to do this; filters are event-based, not entity-based
    When Authenticated Client filters 'Tennis Match' events with meta filter '$.command ? (@ % 2 == 0)'
    Then Event count is 4
    And last Event is 'Ball Returned'

  Scenario: Select subset of events with meta filter
    Given Authenticated Client replays 'Ball Served' events for 'Tennis Match', keys '2023-01-07'
    And remembers selector
    Given Authenticated Client filters, after remembered selector mark, events with meta filter '$.command ? (@ % 2 == 0)'
    Then Event count is 3
    And last Event is 'Ball Returned'

  Scenario: Select subset of events with meta filter after a known event
    Given Authenticated Client replays 'Ball Served' events for 'Tennis Match', keys '2023-01-07'
    And remembers selector
    Given Authenticated Client filters, after remembered selector mark, 2 events with meta filter '$.command ? (@ % 2 == 0)'
    Then Event count is 2
    And last Event is 'Match Started'

  Scenario: Select all events with data filter
    When Authenticated Client filters all data events
    | entity        | event         | filter                    |
    | Tennis Match  | Match Started | $.players ? (@ == "Char") |
    | Tennis Match  | Ball Served   | $.player ? (@ == "Char")  |
    | Tennis Match  | Ball Returned | $.player ? (@ == "Char")  |
    | Tennis Match  | Ball Out      | $.player ? (@ == "Char")  |
    Then Event count is 6
    And last Event is 'Ball Out'

  Scenario: Select events with data filter after remembered event
    Given Authenticated Client replays 'Ball Served' events for 'Tennis Match', keys '2023-01-07'
    And remembers selector
    When Authenticated Client filters data events, after remembered event
    | entity        | event         | filter                    |
    | Tennis Match  | Match Started | $.players ? (@ == "Char") |
    | Tennis Match  | Ball Served   | $.player ? (@ == "Char")  |
    Then Event count is 2
    And last Event is 'Ball Served'

  Scenario: Select limited events with data filter after remembered event
    Given Authenticated Client replays 'Ball Served' events for 'Tennis Match', keys '2023-01-07'
    And remembers selector
    When Authenticated Client filters 4 data events, after remembered event
      | entity        | event         | filter                    |
      | Tennis Match  | Match Started | $.players ? (@ == "Char") |
      | Tennis Match  | Ball Served   | $.player ? (@ == "Char")  |
      | Tennis Match  | Ball Returned | $.player ? (@ == "Char")  |
      | Tennis Match  | Ball Out      | $.player ? (@ == "Char")  |
    Then Event count is 4
    And last Event is 'Ball Served'

  Scenario: Special characters in entities, keys, events and data
    Given Registrar Client registers event 'Bri\ck's "dropped"' in entity 'Te'nnis\"Match"'
    And Authenticated Client appends facts
      | entity            | event               | key           | meta            | data              |
      | Te'nnis\"Match"   | Bri\ck's "dropped"  | 100\24 "41'"   | {"command": 2}  | {"k": "'\\\\jumps"}  |
    When Authenticated Client replays 'Bri\ck's "dropped"' events for 'Te'nnis\"Match"', keys '100\24 "41'"'
    Then Event count is 1

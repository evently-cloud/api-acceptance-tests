Feature: Selectors
  Test the different types of selectors

  Scenario: Set up data for tests
    Given Authenticated Client resets ledger
    And Authenticated Client registers event 'Match Started' in entity 'Tennis Match'
    And Authenticated Client registers event 'Ball Served' in entity 'Tennis Match'
    And Authenticated Client registers event 'Ball Returned' in entity 'Tennis Match'
    And Authenticated Client registers event 'Ball Out' in entity 'Tennis Match'
    And Authenticated Client appends facts
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
    And remembers selector mark
    When Authenticated Client replays all 'Tennis Match' events, key '2023-01-09' after remembered selector mark
    Then Event count is 3
    And last Event is 'Ball Out'

  Scenario: Replay limited number of Events
    Given Authenticated Client replays 5 'Ball Served, Ball Returned, Ball Out' events from 'Tennis Match', keys '2023-01-07, 2023-01-09'
    Then Event count is 5
    And last Event is 'Ball Served'


  Scenario: Replay limited number of events after a known Event
    Given Authenticated Client replays 'Ball Served' events for 'Tennis Match', keys '2023-01-07'
    And remembers selector mark
    Given Authenticated Client replays, after remembered selector mark, 5 'Ball Served, Ball Returned, Ball Out' events from 'Tennis Match', keys '2023-01-07, 2023-01-09'
    Then Event count is 5
    And last Event is 'Ball Returned'

  #test filter selectors
  ## meta
  ## data
  ## both
  ## after
  ## limit

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
    Given Authenticated Client replays all events for 'Tennis Match', keys '2023-01-07,2023-01-09'
    Then Event count is '9'

  Scenario: Replay only some Tennis Match Events for one match
    Given Authenticated Client replays 'Ball Returned' events for 'Tennis Match', keys '2023-01-07'
    Then Event count is '2'

  Scenario: Replay only some Tennis Match Events for one match
    Given Authenticated Client replays 'Ball Returned,Ball Out' events for 'Tennis Match', keys '2023-01-07,2023-01-09'
    Then Event count is '5'

  #test filter selectors
  ## meta
  ## data
  ## both

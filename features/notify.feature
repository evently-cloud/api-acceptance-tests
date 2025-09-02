Feature: Notifications
  Test Notifications

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


  Scenario: Open a channel
    When Authenticated Client opens a notification channel
    Then content is HAL
    And has L3 Nexus profile
    And has notify links
      | rel           | href                      | title                                                                                                                           | profile                           |
      | subscribe     | /notify/CID/subscribe     | Subscribe to selector notifications in this channel                                                                             | https://level3.rest/profiles/form |
      | subscriptions | /notify/CID/subscriptions | Selectors currently subscribed to on this channel                                                                               | https://level3.rest/profiles/info |
      | stream        | /notify/CID/sse           | Notification stream, provided with Server-Sent Events. See https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events  |                                   |
    And closes channel


  Scenario: Subscribe to a replay selector
    Given Authenticated Client opens a notification channel
    And Authenticated Client replays all events for 'Tennis Match', keys '2023-01-09'
    And remembers selector position
    When Authenticated Client subscribes to selector
    And content is HAL
    And has L3 Data profile
    And has L3 Entry Resource profile
    And has notify links
      | rel     | href        | title                                 | profile                             |
      | channel | /notify/CID | Channel this subscription belongs to  | https://level3.rest/profiles/nexus  |
    And Authenticated Client appends fact 'Tennis Match/Ball Served', key '2023-01-09', meta '{}' and data '{"player":"Jer"}'
    And remembers last appended event id
    Then notification matches event id and subscription
    And closes channel


  Scenario: Subscribe to a filter selector
    Given Authenticated Client opens a notification channel
    And Authenticated Client filters all data events
      | event         | filter                    |
      | Ball Served   | $.player ? (@ == "Char")  |
    And remembers selector position
    When Authenticated Client subscribes to selector
    And content is HAL
    And has L3 Data profile
    And has L3 Entry Resource profile
    And has notify links
      | rel     | href        | title                                 | profile                             |
      | channel | /notify/CID | Channel this subscription belongs to  | https://level3.rest/profiles/nexus  |
    And Authenticated Client appends fact 'Tennis Match/Ball Served', key '2023-01-09', meta '{"command":10}' and data '{"player":"Char"}'
    And remembers last appended event id
    Then notification matches event id and subscription
    And closes channel

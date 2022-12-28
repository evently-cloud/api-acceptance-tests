Feature: Look Around
  Test the non-authenticated endpoints

  Scenario: Root Resource
    Given Client starts at root
    Then content is HAL
    And has L3 Home profile
    And has links
      | rel       | href          | title                                     |
      | append    | /append       | Append events to the ledger.              |
      | ledgers   | /ledgers      | Download or reset ledger events.          |
      | registry  | /registry     | Register entity events for the ledger.    |
      | selectors | /selectors    | Selects events to replay from the ledger. |


  #########
  # Append
  #########

  Scenario: Append Resource
    Given Client starts at root
    And follows rel append
    Then content is HAL
    And has L3 Home profile
    And has links
      | rel     | href            | title                                                                                         |
      | factual | /append/fact    | Append factual events to a ledger. Factual events cannot be rejected from the ledger.         |
      | serial  | /append/serial  | Append event to an entity if no other events have been appended after a known previous event. |
      | atomic  | /append/atomic  | Atomically append an event only if a selector has no new events.                              |



  Scenario: Append Fact Resource
    Given Client starts at root
    And follows rel append
    And follows rel factual
    Then has L3 Form profile
    And content is JSON Schema


  Scenario: Append Serial Resource
    Given Client starts at root
    And follows rel append
    And follows rel serial
    Then has L3 Form profile
    And content is JSON Schema


  Scenario: Append Atomic Resource
    Given Client starts at root
    And follows rel append
    And follows rel atomic
    Then has L3 Form profile
    And content is JSON Schema


  #########
  # Ledgers
  #########

  Scenario: Ledgers Resource requires Authorization
    Given Client starts at root
    And follows rel ledgers
    Then Client is not authorized



  ##########
  # Registry
  ##########

  Scenario: Registry Resource
    Given Client starts at root
    And follows rel registry
    Then has L3 Home profile
    And content is HAL
    And has links
      | rel       | href                      | title                       |
      | register  | /registry/register-event  | Register an Event           |
      | entities  | /registry/entities        | Entity and Event Registry   |


  Scenario: Register Event Resource
    Given Client starts at root
    And follows rel registry
    And follows rel register
    Then has L3 Form profile
    And has L3 Add Entry Resource profile
    And content is JSON Schema
    And has links
      | rel                                                     | href               | title                       |
      | https://level3.rest/patterns/list/editable#adds-to-list | /registry/entities | Adds events to this entity. |


  Scenario: Entities Registry Resource requires Authorization
    Given Client starts at root
    And follows rel registry
    And follows rel entities
    Then Client is not authorized


  ###########
  # Selectors
  ###########

  Scenario: Selectors Resource
    Given Client starts at root
    And follows rel selectors
    Then has L3 Home profile
    And content is HAL
    And has links
      | rel    | href              | title                                |
      | replay | /selectors/replay | Replay entity events                 |
      | filter | /selectors/filter | Filter events by meta and event data |


  Scenario: Create Replay Selector Resource requires Authorization
    Given Client starts at root
    And follows rel selectors
    And follows rel replay
    Then Client is not authorized


  Scenario: Create Filter Selector Resource requires Authorization
    Given Client starts at root
    And follows rel selectors
    And follows rel filter
    Then Client is not authorized

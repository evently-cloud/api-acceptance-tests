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


  Scenario: Registry Resource
    Given Client starts at root
    And follows rel registry
    Then content is HAL
    And has L3 Home profile
    And has links
      | rel       | href                      | title                       |
      | register  | /registry/register-event  | Register an Event           |
      | entities  | /registry/entities        | Entity and Event Registry   |


  Scenario: Selectors Resource
    Given Client starts at root
    And follows rel selectors
    Then content is HAL
    And has L3 Home profile
    And has links
      | rel    | href              | title                                |
      | replay | /selectors/replay | Replay entity events                 |
      | filter | /selectors/filter | Filter events by meta and event data |


  Scenario: Append Fact Resource
    Given Client starts at root
    And follows rel append
    And follows rel factual
    Then content is JSON Schema

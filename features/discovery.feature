Feature: Look Around
  Test the non-authenticated endpoints

  Scenario: Root
    Given Client GETs /
    Then content is HAL
    And has L3 Home profile
    And has links
      | rel       | href          | title                                     |
      | registry  | /registry     | Register entity events for the ledger.    |
      | append    | /append       | Append events to the ledger.              |
      | selectors | /selectors    | Selects events to replay from the ledger. |
      | ledgers   |/ledgers       | Download or reset ledger events.          |


  Scenario: Registry
    Given Client GETs /append
    Then content is HAL
    And has L3 Home profile
    And has links
      | rel     | href            | title                                                                                         |
      | factual | /append/fact    | Append factual events to a ledger. Factual events cannot be rejected from the ledger.         |
      | serial  | /append/serial  | Append event to an entity if no other events have been appended after a known previous event. |
      | atomic  | /append/atomic  | Atomically append an event only if a selector has no new events.                              |


  Scenario: Registry
    Given Client GETs /registry
    Then content is HAL
    And has L3 Home profile
    And has links
      | rel       | href                      | title                       |
      | register  | /registry/register-event  | Register an Event           |
      | entities  | /registry/entities        | Entity and Event Registry   |

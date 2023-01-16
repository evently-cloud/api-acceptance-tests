## Append a bunch of events
## Download them
## Add more
## Download with after
Feature: Download Ledgers
  Test downloading full ledger, partial ledger

  Scenario: Set up data for tests
    Given Authenticated Client resets ledger
    And Authenticated Client registers event 'Light Switched On' in entity 'Things'
    And Authenticated Client registers event 'Light Switched Off' in entity 'Things'
    And Authenticated Client registers event 'Ball Bounced' in entity 'Things'
    Then Authenticated Client appends facts
      | entity  | event               | key     | meta  | data                    |
      | Things  | Light Switched On   | kitchen | {}    | {"light visible":true}  |
      | Things  | Light Switched Off  | kitchen | {}    | {}                      |
      | Things  | Light Switched Off  | office  | {}    | {}                      |
      | Things  | Light Switched On   | office  | {}    | {"light visible":false} |
      | Things  | Ball Bounced        | red     | {}    | {"height":10}           |

  Scenario: Download all events
    When Authenticated Client downloads entire ledger
    # Events includes first event -- Ledger Created
    Then Event count is 6
    And last Event is 'Ball Bounced'

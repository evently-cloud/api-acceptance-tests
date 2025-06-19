## Append a bunch of events
## Download them
## Add more
## Download with after
Feature: Download Ledgers
  Test downloading full ledger, partial ledger

  Background: Set up data for tests
    Given Ledger has been created
    And Authenticated Client resets ledger
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

  Scenario: Download events after a mark
    Given Authenticated Client appends fact 'Things/Light Switched Off', key 'garage', meta '{}' and data '{}'
    And remembers last appended event id
    When Authenticated Client appends facts
      | entity  | event               | key     | meta  | data                    |
      | Things  | Light Switched On   | kitchen | {}    | {"light visible":true}  |
      | Things  | Ball Bounced        | red     | {}    | {"height":10}           |
      | Things  | Light Switched Off  | kitchen | {}    | {}                      |
    And Authenticated Client downloads ledger after last appended event
    Then Event count is 3
    And last Event is 'Light Switched Off'

  Scenario: Download limited events
    When Authenticated Client downloads 2 events
    Then Event count is 2
    And last Event is 'Light Switched On'

  Scenario: Download limited events after a mark
    Given Authenticated Client appends fact 'Things/Ball Bounced', key 'green', meta '{}' and data '{"height": 2}'
    And remembers last appended event id
    When Authenticated Client appends facts
      | entity  | event               | key     | meta  | data                    |
      | Things  | Light Switched On   | kitchen | {}    | {"light visible":true}  |
      | Things  | Ball Bounced        | red     | {}    | {"height":10}           |
      | Things  | Light Switched Off  | kitchen | {}    | {}                      |
      | Things  | Ball Bounced        | yellow  | {}    | {"height":5}           |
    And Authenticated Client downloads, after last appended event, 2 events
    Then Event count is 2
    And last Event is 'Ball Bounced'

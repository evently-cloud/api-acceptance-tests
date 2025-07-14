## Append a bunch of events
## Download them
## Add more
## Download with after
Feature: Download Ledgers
  Test downloading full ledger, partial ledger

  Background: Set up data for tests
    Given Ledger has been created
    And Admin Client resets ledger
    And Registrar Client registers event 'Light Switched On' in entity 'Things'
    And Registrar Client registers event 'Light Switched Off' in entity 'Things'
    And Registrar Client registers event 'Ball Bounced' in entity 'Things'
    Then Authenticated Client appends facts
      | entity  | event               | key     | meta  | data                    |
      | Things  | Light Switched On   | kitchen | {}    | {"light visible":true}  |
      | Things  | Light Switched Off  | kitchen | {}    | {}                      |
      | Things  | Light Switched Off  | office  | {}    | {}                      |
      | Things  | Light Switched On   | office  | {}    | {"light visible":false} |
      | Things  | Ball Bounced        | red     | {}    | {"height":10}           |

  Scenario: Download all events
    When Admin Client downloads entire ledger
    # Events includes first event -- Ledger Created and the Event Registered ones
    Then Event count is 9
    And last Event is 'Ball Bounced'

  Scenario: Download events after a mark
    Given Authenticated Client appends fact 'Things/Light Switched Off', key 'garage', meta '{}' and data '{}'
    And remembers last appended event id
    When Authenticated Client appends facts
      | entity  | event               | key     | meta  | data                    |
      | Things  | Light Switched On   | kitchen | {}    | {"light visible":true}  |
      | Things  | Ball Bounced        | red     | {}    | {"height":10}           |
      | Things  | Light Switched Off  | kitchen | {}    | {}                      |
    And Admin Client downloads ledger after last appended event
    Then Event count is 3
    And last Event is 'Light Switched Off'

  Scenario: Download limited events
    When Admin Client downloads 5 events
    Then Event count is 5
    And last Event is 'Light Switched On'

  Scenario: Download limited events after a mark
    Given Authenticated Client appends fact 'Things/Ball Bounced', key 'green', meta '{}' and data '{"height": 2}'
    And remembers last appended event id
    When Authenticated Client appends facts
      | entity  | event               | key     | meta  | data                    |
      | Things  | Light Switched On   | kitchen | {}    | {"light visible":true}  |
      | Things  | Ball Bounced        | red     | {}    | {"height":10}           |
      | Things  | Light Switched Off  | kitchen | {}    | {}                      |
      | Things  | Ball Bounced        | yellow  | {}    | {"height":5}            |
    And Admin Client downloads, after last appended event, 2 events
    Then Event count is 2
    And last Event is 'Ball Bounced'


  Scenario: Download from current link with new append
    Given Admin Client downloads entire ledger
    And remembers 'current' link
    When Authenticated Client appends fact 'Thinks/Light Switched On', key 'bathroom', meta '{}' and data '{}'
    And Admin client gets remembered link
    Then Event count is 1
    And last Event is 'Light Switched On'


  Scenario: Download from current link with no new appends
    Given Admin Client downloads entire ledger
    And remembers 'current' link
    When Admin client gets remembered link
    Then Event count is 0
    # Do this twice, it's returning an incorrect current link value that starts at the beginning
    And remembers 'current' link
    When Admin client gets remembered link
    Then Event count is 0


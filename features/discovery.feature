Feature: Look Around
  Test the non-authenticated endpoints

  Scenario: Root Resource
    Given Client starts at root
    Then content is HAL
    And has L3 Home profile
    And has links
      | rel       | href        | title                                 | profile                           |
      | append    | /append     | Append Events to the Ledger           | https://level3.rest/profiles/home |
      | ledgers   | /ledgers    | Manage the Ledger                     | https://level3.rest/profiles/home |
      | registry  | /registry   | Register Entity Events for the Ledger | https://level3.rest/profiles/home |
      | selectors | /selectors  | Selects Events From the Ledger        | https://level3.rest/profiles/home |


  #########
  # Append
  #########

  Scenario: Append Resource
    Given Client starts at root
    And follows rel 'append'
    Then content is HAL
    And has L3 Home profile
    And has links
      | rel     | href            | title                                               | profile                           |
      | factual | /append/fact    | Append Factual Events                               | https://level3.rest/profiles/form |
      | serial  | /append/serial  | Append Serial Events to an Entity                   | https://level3.rest/profiles/form |
      | atomic  | /append/atomic  | Atomically Append Events Given a Selector Condition | https://level3.rest/profiles/form |


  Scenario: Append Fact Resource
    Given Client starts at root
    And follows rel 'append'
    And follows rel 'factual'
    Then has L3 Form profile
    And content is JSON Schema


  Scenario: Append Serial Resource
    Given Client starts at root
    And follows rel 'append'
    And follows rel 'serial'
    Then has L3 Form profile
    And content is JSON Schema


  Scenario: Append Atomic Resource
    Given Client starts at root
    And follows rel 'append'
    And follows rel 'atomic'
    Then has L3 Form profile
    And content is JSON Schema


  #########
  # Ledgers
  #########

  Scenario: Ledgers Resource requires Authorization
    Given Client starts at root
    And follows rel 'ledgers'
    Then Client is not authorized



  ##########
  # Registry
  ##########

  Scenario: Registry Resource
    Given Client starts at root
    And follows rel 'registry'
    Then has L3 Home profile
    And content is HAL
    And has links
      | rel       | href                      | title                           | profile                           |
      | register  | /registry/register-event  | Register an Event               | https://level3.rest/profiles/form |
      | entities  | /registry/entities        | Entities With Registered Events | https://level3.rest/profiles/home |


  Scenario: Register Event Resource
    Given Client starts at root
    And follows rel 'registry'
    And follows rel 'register'
    Then has L3 Form profile
    And has L3 Add Entry Resource profile
    And content is JSON Schema
    And has links
      | rel                                                     | href                | title                                    |
      | https://level3.rest/patterns/list/editable#adds-to-list | /registry/entities  | List of Entities With Registered Events  |


  Scenario: Entities Registry Resource requires Authorization
    Given Client starts at root
    And follows rel 'registry'
    And follows rel 'entities'
    Then Client is not authorized


  ###########
  # Selectors
  ###########

  Scenario: Selectors Resource
    Given Client starts at root
    And follows rel 'selectors'
    Then has L3 Home profile
    And content is HAL
    And has links
      | rel     | href               | title                              | profile                             |
      | replay  | /selectors/replay  | Replay an Entity's Events          | https://level3.rest/profiles/lookup |
      | filter  | /selectors/filter  | Select Events With a Filter Query  | https://level3.rest/profiles/lookup |


  Scenario: Create Replay Selector Resource requires Authorization
    Given Client starts at root
    And follows rel 'selectors'
    And follows rel 'replay'
    Then Client is not authorized


  Scenario: Create Filter Selector Resource requires Authorization
    Given Client starts at root
    And follows rel 'selectors'
    And follows rel 'filter'
    Then Client is not authorized

Feature: Look Around
  Test the public endpoints

  Background:
    Given Ledger has been created
    And Client starts at root

  Scenario: Root Resource
    Then content is HAL
    And has L3 Home profile
    And has links
      | rel           | href        | title                                 | profile                           |
      | append        | /append     | Append Events to the Ledger           | https://level3.rest/profiles/home |
      | ledgers       | /ledgers    | Manage the Ledger                     | https://level3.rest/profiles/home |
      | notifications | /notify     | Event notifications from Selectors    | https://level3.rest/profiles/home |
      | registry      | /registry   | Register Entity Events for the Ledger | https://level3.rest/profiles/home |
      | selectors     | /selectors  | Selects Events From the Ledger        | https://level3.rest/profiles/home |


  #########
  # Append
  #########

  Scenario: Append Resource
    Given follows rel 'append'
    Then content is HAL
    And has L3 Home profile
    And has links
      | rel     | href            | title                                               | profile                           |
      | factual | /append/fact    | Append Factual Events                               | https://level3.rest/profiles/form |
      | serial  | /append/serial  | Append Serial Events to an Entity                   | https://level3.rest/profiles/form |
      | atomic  | /append/atomic  | Atomically Append Events Given a Selector Condition | https://level3.rest/profiles/form |


  Scenario: Append Fact Resource
    Given follows rels 'append,factual'
    Then has L3 Form profile
    And content is JSON Schema


  Scenario: Append Serial Resource
    Given follows rels 'append,serial'
    Then has L3 Form profile
    And content is JSON Schema


  Scenario: Append Atomic Resource
    Given follows rels 'append,atomic'
    Then has L3 Form profile
    And content is JSON Schema


  #########
  # Ledgers
  #########

  Scenario: Ledgers Resource requires Authorization
    Given follows rel 'ledgers'
    Then Client is not authorized


  ##########
  # Registry
  ##########

  Scenario: Registry Resource
    Given follows rel 'registry'
    Then has L3 Home profile
    And content is HAL
    And has links
      | rel       | href                      | title                           | profile                           |
      | register  | /registry/register-event  | Register an Event               | https://level3.rest/profiles/form |
      | entities  | /registry/entities        | Entities With Registered Events | https://level3.rest/profiles/home |


  Scenario: Register Event Resource
    Given follows rels 'registry,register'
    Then has L3 Form profile
    And has L3 Add Entry Resource profile
    And content is JSON Schema
    And has links
      | rel                                                     | href                | title                                    |
      | https://level3.rest/patterns/list/editable#adds-to-list | /registry/entities  | List of Entities With Registered Events  |


  Scenario: Entities Registry Resource requires Authorization
    Given follows rels 'registry,entities'
    Then Client is not authorized


  ###########
  # Selectors
  ###########

  Scenario: Selectors Resource
    Given follows rel 'selectors'
    Then has L3 Home profile
    And content is HAL
    And has links
      | rel     | href               | title                              | profile                             |
      | replay  | /selectors/replay  | Replay an Entity's Events          | https://level3.rest/profiles/lookup |
      | filter  | /selectors/filter  | Select Events With a Filter Query  | https://level3.rest/profiles/lookup |


  Scenario: Create Replay Selector Resource requires Authorization
    Given follows rels 'selectors,replay'
    Then Client is not authorized


  Scenario: Create Filter Selector Resource requires Authorization
    Given follows rels 'selectors,filter'
    Then Client is not authorized


  ###########
  # Selectors
  ###########

  Scenario: Notifications Resource
    Given follows rel 'notifications'
    Then has L3 Home profile
    And content is HAL
    And has links
      | rel           | href                  | title              | profile                             |
      | open-channel  | /notify/open-channel  | Open a new channel | https://level3.rest/profiles/action |


  Scenario: Discover Notification Open Channel Resource
    Given follows rels 'notifications,open-channel'
    Then has L3 Action profile
    And content is HAL
    And has links
      | rel         | href                  | title              | profile                             |
      | open-action | /notify/open-channel  | Open a new channel | https://level3.rest/profiles/action |


  Scenario: Cannot open Notification channel without Authorization
    Then Client fails to open a notification channel

Feature: Public Look Around
  Test the public endpoints

  Background:
    Given Ledger has been created
    And Public Client starts at root

  Scenario: Root Resource
    Then content is HAL
    And has L3 Home profile
    And has links
      | rel           | href        | title                                 | profile                             |
      | append        | /append     | Append Events to the Ledger           | https://level3.rest/profiles/form   |
      | ledgers       | /ledgers    | Manage the Ledger                     | https://level3.rest/profiles/home   |
      | notifications | /notify     | Event notifications from Selectors    | https://level3.rest/profiles/home   |
      | registry      | /registry   | Register Entity Events for the Ledger | https://level3.rest/profiles/home   |
      | selectors     | /selectors  | Selects Events From the Ledger        | https://level3.rest/profiles/lookup |


  #########
  # Append
  #########

  Scenario: Append Resource
    Given follows rel 'append'
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
      | rel       | href                      | title                              | profile                                          |
      | register  | /registry/register-event  | Register an Event                  | https://level3.rest/profiles/form                |
      | entities  | /registry/entities        | Registered Events scoped by Entity | https://level3.rest/patterns/list#list-resource  |


  Scenario: Register Event Resource
    Given follows rels 'registry,register'
    Then has L3 Form profile
    And has L3 Add Entry Resource profile
    And content is JSON Schema
    And has links
      | rel                                                     | href              | title                      |
      | https://level3.rest/patterns/list/editable#adds-to-list | /registry/events  | List of Registered Events  |


  Scenario: Entities Registry Resource requires Authorization
    Given follows rels 'registry,entities'
    Then Client is not authorized


  ###########
  # Selectors
  ###########

  Scenario: Selectors Resource requires Authorization
    Given follows rel 'selectors'
    Then Client is not authorized


  ###########
  # Notifications
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

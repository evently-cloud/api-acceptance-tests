Feature: Ledgers
  Test ledger resources

  Scenario: Discover ledgers
    Given Authenticated Client starts at root
    And follows rel ledgers
    Then has L3 Home profile
    And content is HAL
    And body has string field 'name'
    And body has number field 'count'
    And has links
      | rel       | href              | title                                                                       |
      | reset     | /ledgers/reset    | Reset the ledger's events. Provides a form to submit as the reset request.  |
      | download  | /ledgers/download | Download the ledger's events.                                               |


    Scenario: Discover reset ledger
      Given Authenticated Client starts at root
      And follows rel ledgers
      And follows rel reset
      Then has L3 Form profile
      And content is JSON Schema


    Scenario: Discover download ledger
      Given Authenticated Client starts at root
      And follows rel ledgers
      And follows rel download
      Then has L3 Lookup profile
      And has L3 Representation profile
      And content is JSON Schema

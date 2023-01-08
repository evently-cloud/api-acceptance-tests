Feature: Ledgers
  Test ledger resources

  Scenario: Discover ledgers
    Given Authenticated Client starts at root
    And follows rel 'ledgers'
    Then has L3 Home profile
    And content is HAL
    And body has number field 'count'
    And body has field 'name' with value 'acceptance tests'
    And has links
      | rel       | href              | title                         | profile                             |
      | reset     | /ledgers/reset    | Reset the Ledger's Events     | https://level3.rest/profiles/form   |
      | download  | /ledgers/download | Download the Ledger's Events  | https://level3.rest/profiles/lookup |


    Scenario: Discover reset ledger
      Given Authenticated Client starts at root
      And follows rels 'ledgers,reset'
      Then has L3 Form profile
      And content is JSON Schema


    Scenario: Discover download ledger
      Given Authenticated Client starts at root
      And follows rels 'ledgers,download'
      Then has L3 Lookup profile
      And has L3 Representation profile
      And content is JSON Schema

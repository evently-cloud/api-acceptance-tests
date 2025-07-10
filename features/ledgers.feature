Feature: Ledgers
  Test ledger resources

  Background:
    Given Ledger has been created
    And Admin Client starts at root
    And follows rel 'ledgers'

  Scenario: Discover ledgers
    Then has L3 Home profile
    And content is HAL


  Scenario: Discover a known Ledger
    Given follows list entry with name 'API acceptance test ledger'
    And body has number field 'count'
    And body has field 'name' with value 'API acceptance test ledger'
    And has links
      | rel       |  title                         | profile                             |
      | reset     |  Reset the Ledger's Events     | https://level3.rest/profiles/form   |
      | download  |  Download the Ledger's Events  | https://level3.rest/profiles/lookup |


    Scenario: Discover reset ledger
      Given follows list entry with name 'API acceptance test ledger'
      Given follows rel 'reset'
      Then has L3 Form profile
      And content is JSON Schema


    Scenario: Discover download ledger
      Given follows list entry with name 'API acceptance test ledger'
      Given follows rels 'download'
      Then has L3 Lookup profile
      And has L3 Representation profile
      And content is JSON Schema

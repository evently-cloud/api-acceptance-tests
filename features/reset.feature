Feature: Reset ledger
  Tests resetting a ledger to a specific point

  Background:
    Given Ledger has been created

  Scenario: Reset Events to a known place
    Given Admin Client resets ledger
    And Registrar Client registers event 'Thing Created' in entity 'tests'
    And Authenticated Client appends fact 'tests/Thing Created', key '1', meta '{}' and data '{"name":1}'
    And remembers last appended event id
    And Authenticated Client appends fact 'tests/Thing Created', key '1', meta '{}' and data '{"name":2}'
    And Admin Client starts at root
    And follows rel 'ledgers'
    And follows list entry with name 'API acceptance test ledger'
    And body has field 'count' with value '4'
    When resets ledger to remembered event id
    And Admin Client starts at root
    Then follows rel 'ledgers'
    And follows list entry with name 'API acceptance test ledger'
    And body has field 'count' with value '3'

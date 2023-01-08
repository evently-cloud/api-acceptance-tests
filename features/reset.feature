Feature: Reset ledger
  Tests resetting a ledger to a specific point

  Scenario: Reset Events to a known place
    Given Authenticated Client resets ledger
    And Authenticated Client registers event 'Thing Created' in entity 'tests'
    And Authenticated Client appends fact 'tests/Thing Created', key '1', meta '{}' and data '{"name":1}'
    And remembers last event id
    And Authenticated Client appends fact 'tests/Thing Created', key '1', meta '{}' and data '{"name":2}'
    And Authenticated Client starts at root
    And follows rel 'ledgers'
    And body has field 'count' with value '2'
    When resets ledger to remembered event id
    And Authenticated Client starts at root
    Then follows rel 'ledgers'
    And body has field 'count' with value '1'

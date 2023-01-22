Feature: Append Events
  Test all the ways to append events

  Scenario: Prepare for tests
    Given Authenticated Client resets ledger
    And Authenticated Client registers event 'Item Stocked' in entity 'Store'
    And Authenticated Client registers event 'Item Added' in entity 'Cart'
    And Authenticated Client registers event 'Item Removed' in entity 'Cart'
    And Authenticated Client registers event 'Cart Purchased' in entity 'Cart'


  Scenario: Cannot append unregistered fact
    Given Authenticated Client fails to append fact 'Store/Alarm Triggered', key 'Vancouver', meta '{}' and data '{}' because '403'


  Scenario: Discover factual append form
    Given Authenticated Client starts at root
    And follows rels 'append,factual'
    Then content is JSON Schema
    And has L3 Form profile


  Scenario: Append facts with idempotency key
    Given Authenticated Client appends idempotency-key 'today', fact 'Store/Item Stocked', key 'Vancouver', meta '{}' and data '{"sku":"Gum"}'
    And remembers last appended event id
    When Authenticated Client appends idempotency-key 'today', fact 'Store/Item Stocked', key 'Vancouver', meta '{}' and data '{"sku":"Gum"}'
    Then appended event id matches last appended event id
    And Authenticated Client fails to append idempotency-key 'today', fact 'Cart/Item Added', key 'Vancouver', meta '{}' and data '{"sku":"Gum"}' because '422'


  Scenario: Append facts
    Given Authenticated Client appends facts
      | entity  | event               | key       | meta              | data                        |
      | Store   | Item Stocked        | Vancouver | {"actor":"Ami"}   | {"sku":"Fudge_Brownie"}     |
      | Store   | Item Stocked        | Vancouver | {"actor":"Ami"}   | {"sku":"Violet_Crumble"}    |
      | Store   | Item Stocked        | Vancouver | {"actor":"Ami"}   | {"sku":"Chocolate_Cookie"}  |
      | Store   | Item Stocked        | Vancouver | {"actor":"Marc"}  | {"sku":"Peanuts"}           |
      | Store   | Item Stocked        | Vancouver | {"actor":"Marc"}  | {"sku":"Carrots"}           |


  Scenario: Discover serial append form
    Given Authenticated Client starts at root
    And follows rels 'append,serial'
    Then content is JSON Schema
    And has L3 Form profile


  Scenario: Append events serially
    Given Authenticated Client appends fact 'Cart/Item Added', key '1', meta '{}' and data '{"sku":"Peanuts"}'
    And remembers last appended event id
    Then Authenticated Client serially appends event 'Cart/Item Added', key '1', meta '{}' and data '{"sku":"Fudge_Brownie"}'


  Scenario: Cannot Append events serially without most recent event id
    Given Authenticated Client appends fact 'Cart/Item Added', key '1', meta '{}' and data '{"sku":"Peanuts"}'
    And remembers last appended event id
    And Authenticated Client serially appends event 'Cart/Item Added', key '1', meta '{}' and data '{"sku":"Chocolate_Cookie"}'
    Then Authenticated Client fails to append serial event 'Cart/Item Added', key '1', meta '{}' and data '{"sku":"Fudge_Brownie"}' because '409'


  Scenario: Append serial events with idempotency key
    # mixing append type to show it doesn't matter with idempotency-key
    Given Authenticated Client appends idempotency-key 'glucose', fact 'Cart/Item Added', key 'Vancouver', meta '{}' and data '{"sku":"Violet_Crumble"}'
    And remembers last appended event id
    When Authenticated Client serially appends idempotency-key 'glucose', event 'Cart/Item Added', key 'Vancouver', meta '{}' and data '{"sku":"Violet_Crumble"}'
    Then appended event id matches last appended event id


  Scenario: Discover atomic append form
    Given Authenticated Client starts at root
    And follows rels 'append,atomic'
    Then content is JSON Schema
    And has L3 Form profile


  Scenario: Append atomic events
  Given Authenticated Client replays 'Cart Purchased' events for 'Cart', keys '1'
  And Event count is 0
  Then remembers selector
  And Authenticated Client atomically appends event 'Cart/Item Added', key '1', meta '{}' and data '{"sku":"Carrots"}'


  Scenario: Append atomic events with idempotency key
    Given Authenticated Client replays 'Cart Purchased' events for 'Cart', keys '1'
    And remembers selector
    And Authenticated Client atomically appends idempotency-key 'hazelnuts', event 'Cart/Item Added', key '1', meta '{}' and data '{"sku":"Carrots"}'
    And remembers last appended event id
    When Authenticated Client atomically appends idempotency-key 'hazelnuts', event 'Cart/Item Added', key '1', meta '{}' and data '{"sku":"Carrots"}'
    Then appended event id matches last appended event id


  Scenario: Cannot atomically append events when selector has new matches
    Given Authenticated Client replays 'Cart Purchased' events for 'Cart', keys '1'
    And Event count is 0
    And remembers selector
    When Authenticated Client atomically appends event 'Cart/Cart Purchased', key '1', meta '{}' and data '{"payment":"cash"}'
    Then Authenticated Client fails to atomically append event 'Cart/Cart Purchased', key '1', meta '{}' and data '{"payment":"Debit"}' because '409'


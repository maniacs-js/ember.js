import {
  run,
  computed,
  isFeatureEnabled,
  instrumentationSubscribe,
  instrumentationUnsubscribe
} from 'ember-metal';
import { RenderingTest, moduleFor } from '../../utils/test-case';
import { Component, INVOKE } from '../../utils/helpers';

if (isFeatureEnabled('ember-improved-instrumentation')) {
  moduleFor('Helpers test: closure {{action}} improved instrumentation', class extends RenderingTest {

    subscribe(eventName, options) {
      this.subscriber = instrumentationSubscribe(eventName, options);
    }

    teardown() {
      if (this.subscriber) {
        instrumentationUnsubscribe(this.subscriber);
      }

      super.teardown();
    }

    ['@test interaction event subscriber should be passed parameters']() {
      let actionParam = 'So krispy';
      let beforeParameters = [];
      let afterParameters = [];

      let InnerComponent = Component.extend({
        actions: {
          fireAction() {
            this.attrs.submit(actionParam);
          }
        }
      });

      let OuterComponent = Component.extend({
        outerSubmit() {
        }
      });

      this.registerComponent('inner-component', {
        ComponentClass: InnerComponent,
        template: '<button id="instrument-button" {{action "fireAction"}}>What it do</button>'
      });

      this.registerComponent('outer-component', {
        ComponentClass: OuterComponent,
        template: '{{inner-component submit=(action outerSubmit)}}'
      });

      this.subscribe('interaction.ember-action', {
        before(name, timestamp, payload) {
          beforeParameters.push(payload.args);
        },
        after(name, timestamp, payload) {
          afterParameters.push(payload.args);
        }
      });

      this.render(`{{outer-component}}`);

      this.runTask(() => {
        this.$('#instrument-button').trigger('click');
      });

      this.assert.deepEqual(beforeParameters, [[], [actionParam]], 'instrumentation subscriber before function was passed closure action parameters');
      this.assert.deepEqual(afterParameters, [[actionParam], []], 'instrumentation subscriber after function was passed closure action parameters');
    }

    ['@test interaction event subscriber should be passed target']() {
      let beforeParameters = [];
      let afterParameters = [];

      let InnerComponent = Component.extend({
        myProperty: 'inner-thing',
        actions: {
          fireAction() {
            this.attrs.submit();
          }
        }
      });

      let OuterComponent = Component.extend({
        myProperty: 'outer-thing',
        outerSubmit() {}
      });

      this.registerComponent('inner-component', {
        ComponentClass: InnerComponent,
        template: '<button id="instrument-button" {{action "fireAction"}}>What it do</button>'
      });

      this.registerComponent('outer-component', {
        ComponentClass: OuterComponent,
        template: '{{inner-component submit=(action outerSubmit)}}'
      });

      this.subscribe('interaction.ember-action', {
        before(name, timestamp, payload) {
          beforeParameters.push(payload.target.get('myProperty'));
        },
        after(name, timestamp, payload) {
          afterParameters.push(payload.target.get('myProperty'));
        }
      });

      this.render(`{{outer-component}}`);

      this.runTask(() => {
        this.$('#instrument-button').trigger('click');
      });

      this.assert.deepEqual(beforeParameters, ['inner-thing', 'outer-thing'], 'instrumentation subscriber before function was passed target');
      this.assert.deepEqual(afterParameters, ['outer-thing', 'inner-thing'], 'instrumentation subscriber after function was passed target');
    }

    ['@test instrumented action should return value']() {
      let returnedValue = 'Chris P is so krispy';
      let beforeParameter;
      let afterParameter;
      let actualReturnedValue;

      let InnerComponent = Component.extend({
        actions: {
          fireAction() {
            actualReturnedValue = this.attrs.submit();
          }
        }
      });

      let OuterComponent = Component.extend({
        outerSubmit() {
          return returnedValue;
        }
      });

      this.registerComponent('inner-component', {
        ComponentClass: InnerComponent,
        template: '<button id="instrument-button" {{action "fireAction"}}>What it do</button>'
      });

      this.registerComponent('outer-component', {
        ComponentClass: OuterComponent,
        template: '{{inner-component submit=(action outerSubmit)}}'
      });

      this.subscribe('interaction.ember-action', {
        before(name, timestamp, payload) {
          beforeParameter = payload.target.get('myProperty');
        },
        after(name, timestamp, payload) {
          afterParameter = payload.target.get('myProperty');
        }
      });

      this.render(`{{outer-component}}`);

      this.runTask(() => {
        this.$('#instrument-button').trigger('click');
      });

      this.assert.equal(actualReturnedValue, returnedValue, 'action can return to caller');
    }
  });
}

moduleFor('Helpers test: closure {{action}}', class extends RenderingTest {

  ['@test action should be called']() {
    let outerActionCalled = false;
    let component;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        component = this;
      },
      fireAction() {
        this.attrs.submit();
      }
    });

    let OuterComponent = Component.extend({
      outerSubmit() {
        outerActionCalled = true;
      }
    });

    this.registerComponent('inner-component', { ComponentClass: InnerComponent, template: 'inner' });
    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: '{{inner-component submit=(action outerSubmit)}}'
    });

    this.render('{{outer-component}}');

    this.runTask(() => {
      component.fireAction();
    });

    this.assert.ok(outerActionCalled, 'the action was called');
  }

  ['@test an error is triggered when bound action function is undefined']() {
    this.registerComponent('inner-component', {
      template: 'inner'
    });
    this.registerComponent('outer-component', {
      template: '{{inner-component submit=(action somethingThatIsUndefined)}}'
    });

    this.assert.throws(() => {
      this.render('{{outer-component}}');
    }, /Action passed is null or undefined in \(action[^)]*\) from .*\./);
  }

  ['@test an error is triggered when bound action being passed in is a non-function']() {
    this.registerComponent('inner-component', {
      template: 'inner'
    });
    this.registerComponent('outer-component', {
      ComponentClass: Component.extend({
        nonFunctionThing: {}
      }),
      template: '{{inner-component submit=(action nonFunctionThing)}}'
    });

    this.assert.throws(() => {
      this.render('{{outer-component}}');
    }, /An action could not be made for `.*` in .*\. Please confirm that you are using either a quoted action name \(i\.e\. `\(action '.*'\)`\) or a function available in .*\./);
  }

  ['@test [#12718] a nice error is shown when a bound action function is undefined and it is passed as attrs.foo']() {
    this.registerComponent('inner-component', {
      template: '<button id="inner-button" {{action (action attrs.external-action)}}>Click me</button>'
    });

    this.registerComponent('outer-component', {
      template: '{{inner-component}}'
    });

    this.assert.throws(() => {
      this.render('{{outer-component}}');
    }, /Action passed is null or undefined in \(action[^)]*\) from .*\./);
  }

  ['@test action value is returned']() {
    let expectedValue = 'terrible tom';
    let returnedValue;
    let innerComponent;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        innerComponent = this;
      },
      fireAction() {
        returnedValue = this.attrs.submit();
      }
    });

    let OuterComponent = Component.extend({
      outerSubmit() {
        return expectedValue;
      }
    });

    this.registerComponent('inner-component', {
      ComponentClass: InnerComponent,
      template: 'inner'
    });

    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: '{{inner-component submit=(action outerSubmit)}}'
    });

    this.render('{{outer-component}}');

    this.runTask(() => {
      innerComponent.fireAction();
    });

    this.assert.equal(returnedValue, expectedValue, 'action can return to caller');
  }

  ['@test action should be called on the correct scope']() {
    let innerComponent;
    let outerComponent;
    let actualComponent;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        innerComponent = this;
      },
      fireAction() {
        this.attrs.submit();
      }
    });

    let OuterComponent = Component.extend({
      init() {
        this._super(...arguments);
        outerComponent = this;
      },
      isOuterComponent: true,
      outerSubmit() {
        actualComponent = this;
      }
    });

    this.registerComponent('inner-component', {
      ComponentClass: InnerComponent,
      template: 'inner'
    });

    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: '{{inner-component submit=(action outerSubmit)}}'
    });

    this.render('{{outer-component}}');

    this.runTask(() => {
      innerComponent.fireAction();
    });

    this.assert.equal(actualComponent, outerComponent, 'action has the correct context');
    this.assert.ok(actualComponent.isOuterComponent, 'action has the correct context');
  }

  ['@test arguments to action are passed, curry']() {
    let first = 'mitch';
    let second =  'martin';
    let third = 'matt';
    let fourth = 'wacky wycats';

    let innerComponent;
    let actualArgs;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        innerComponent = this;
      },
      fireAction() {
        this.attrs.submit(fourth);
      }
    });

    let OuterComponent = Component.extend({
      third,
      outerSubmit(actualFirst, actualSecond, actualThird, actualFourth) {
        actualArgs = [...arguments];
      }
    });

    this.registerComponent('inner-component', {
      ComponentClass: InnerComponent,
      template: 'inner'
    });

    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: `{{inner-component submit=(action (action outerSubmit "${first}") "${second}" third)}}`
    });

    this.render('{{outer-component}}');

    this.runTask(() => {
      innerComponent.fireAction();
    });

    this.assert.deepEqual(actualArgs, [first, second, third, fourth], 'action has the correct args');
  }

  ['@test `this` can be passed as an argument']() {
    let value = {};
    let component;
    let innerComponent;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        innerComponent = this;
      },
      fireAction() {
        this.attrs.submit();
      }
    });

    let OuterComponent = Component.extend({
      init() {
        this._super(...arguments);
        component = this;
      },
      actions: {
        outerAction(incomingValue) {
          value = incomingValue;
        }
      }
    });

    this.registerComponent('inner-component', { ComponentClass: InnerComponent, template: 'inner' });
    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: '{{inner-component submit=(action "outerAction" this)}}'
    });

    this.render('{{outer-component}}');

    this.runTask(() => {
      innerComponent.fireAction();
    });

    this.assert.strictEqual(value, component, 'the component is passed at `this`');
  }

  ['@test arguments to action are bound']() {
    let value = 'lazy leah';

    let innerComponent;
    let outerComponent;
    let actualArg;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        innerComponent = this;
      },
      fireAction() {
        this.attrs.submit();
      }
    });

    let OuterComponent = Component.extend({
      init() {
        this._super(...arguments);
        outerComponent = this;
      },
      value: '',
      outerSubmit(incomingValue) {
        actualArg = incomingValue;
      }
    });

    this.registerComponent('inner-component', {
      ComponentClass: InnerComponent,
      template: 'inner'
    });

    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: `{{inner-component submit=(action outerSubmit value)}}`
    });

    this.render('{{outer-component}}');

    this.runTask(() => {
      innerComponent.fireAction();
    });

    this.assert.strictEqual(actualArg, '', 'action has the correct first arg');

    this.runTask(() => {
      outerComponent.set('value', value);
    });

    this.runTask(() => {
      innerComponent.fireAction();
    });

    this.assert.strictEqual(actualArg, value, 'action has the correct first arg');
  }

  ['@test array arguments are passed correctly to action']() {
    let first = 'foo';
    let second = [3, 5];
    let third = [4, 9];

    let actualFirst;
    let actualSecond;
    let actualThird;

    let innerComponent;
    let outerComponent;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        innerComponent = this;
      },
      fireAction() {
        this.attrs.submit(second, third);
      }
    });

    let OuterComponent = Component.extend({
      init() {
        this._super(...arguments);
        outerComponent = this;
      },
      outerSubmit(incomingFirst, incomingSecond, incomingThird) {
        actualFirst = incomingFirst;
        actualSecond = incomingSecond;
        actualThird = incomingThird;
      }
    });

    this.registerComponent('inner-component', {
      ComponentClass: InnerComponent,
      template: 'inner'
    });

    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: `{{inner-component submit=(action outerSubmit first)}}`
    });

    this.render('{{outer-component}}');

    this.runTask(() => {
      outerComponent.set('first', first);
      outerComponent.set('second', second);
    });

    this.runTask(() => {
      innerComponent.fireAction();
    });

    this.assert.equal(actualFirst, first, 'action has the correct first arg');
    this.assert.equal(actualSecond, second, 'action has the correct second arg');
    this.assert.equal(actualThird, third, 'action has the correct third arg');
  }

  ['@test mut values can be wrapped in actions, are settable']() {
    let newValue = 'trollin trek';

    let innerComponent;
    let outerComponent;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        innerComponent = this;
      },
      fireAction() {
        this.attrs.submit(newValue);
      }
    });

    let OuterComponent = Component.extend({
      init() {
        this._super(...arguments);
        outerComponent = this;
      },
      outerMut: 'patient peter'
    });

    this.registerComponent('inner-component', {
      ComponentClass: InnerComponent,
      template: 'inner'
    });

    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: `{{inner-component submit=(action (mut outerMut))}}`
    });

    this.render('{{outer-component}}');

    this.runTask(() => {
      innerComponent.fireAction();
    });

    this.assert.equal(outerComponent.get('outerMut'), newValue, 'mut value is set');
  }

  ['@test mut values can be wrapped in actions, are settable with a curry']() {
    let newValue = 'trollin trek';

    let innerComponent;
    let outerComponent;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        innerComponent = this;
      },
      fireAction() {
        this.attrs.submit();
      }
    });

    let OuterComponent = Component.extend({
      init() {
        this._super(...arguments);
        outerComponent = this;
      },
      outerMut: 'patient peter'
    });

    this.registerComponent('inner-component', {
      ComponentClass: InnerComponent,
      template: 'inner'
    });

    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: `{{inner-component submit=(action (mut outerMut) '${newValue}')}}`
    });

    this.render('{{outer-component}}');

    this.runTask(() => {
      innerComponent.fireAction();
    });

    this.assert.equal(outerComponent.get('outerMut'), newValue, 'mut value is set');
  }

  ['@test action can create closures over actions']() {
    let first = 'raging robert';
    let second = 'mild machty';
    let returnValue = 'butch brian';

    let actualFirst;
    let actualSecond;
    let actualReturnedValue;

    let innerComponent;
    let outerComponent;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        innerComponent = this;
      },
      fireAction() {
        actualReturnedValue = this.attrs.submit(second);
      }
    });

    let OuterComponent = Component.extend({
      init() {
        this._super(...arguments);
        outerComponent = this;
      },
      actions: {
        outerAction(incomingFirst, incomingSecond) {
          actualFirst = incomingFirst;
          actualSecond = incomingSecond;
          return returnValue;
        }
      }
    });

    this.registerComponent('inner-component', {
      ComponentClass: InnerComponent,
      template: 'inner'
    });

    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: `{{inner-component submit=(action 'outerAction' '${first}')}}`
    });

    this.render('{{outer-component}}');

    this.runTask(() => {
      innerComponent.fireAction();
    });

    this.assert.equal(actualReturnedValue, returnValue, 'return value is present');
    this.assert.equal(actualFirst, first, 'first argument is correct');
    this.assert.equal(actualSecond, second, 'second argument is correct');
  }

  ['@test provides a helpful error if an action is not present']() {
    let InnerComponent = Component.extend({
    });

    let OuterComponent = Component.extend({
      actions: {
        something() {
          // this is present to ensure `actions` hash is present
          // a different error is triggered if `actions` is missing
          // completely
        }
      }
    });

    this.registerComponent('inner-component', {
      ComponentClass: InnerComponent,
      template: 'inner'
    });

    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: `{{inner-component submit=(action 'doesNotExist')}}`
    });

    this.assert.throws(() => {
      this.render('{{outer-component}}');
    }, /An action named 'doesNotExist' was not found in /);
  }

  ['@test provides a helpful error if actions hash is not present']() {
    let InnerComponent = Component.extend({
    });

    let OuterComponent = Component.extend({
    });

    this.registerComponent('inner-component', {
      ComponentClass: InnerComponent,
      template: 'inner'
    });

    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: `{{inner-component submit=(action 'doesNotExist')}}`
    });

    this.assert.throws(() => {
      this.render('{{outer-component}}');
    }, /An action named 'doesNotExist' was not found in /);
  }

  ['@test action can create closures over actions with target']() {
    let innerComponent;
    let actionCalled = false;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        innerComponent = this;
      },
      fireAction() {
        this.attrs.submit();
      }
    });

    let OuterComponent = Component.extend({
      otherComponent: computed(function() {
        return {
          actions: {
            outerAction() {
              actionCalled = true;
            }
          }
        };
      })
    });

    this.registerComponent('inner-component', {
      ComponentClass: InnerComponent,
      template: 'inner'
    });

    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: `{{inner-component submit=(action 'outerAction' target=otherComponent)}}`
    });

    this.render('{{outer-component}}');

    this.runTask(() => {
      innerComponent.fireAction();
    });

    this.assert.ok(actionCalled, 'action called on otherComponent');
  }

  ['@test value can be used with action over actions']() {
    let newValue = 'yelping yehuda';

    let innerComponent;
    let actualValue;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        innerComponent = this;
      },
      fireAction() {
        this.attrs.submit({
          readProp: newValue
        });
      }
    });

    let OuterComponent = Component.extend({
      outerContent: {
        readProp: newValue
      },
      actions: {
        outerAction(incomingValue) {
          actualValue = incomingValue;
        }
      }
    });

    this.registerComponent('inner-component', {
      ComponentClass: InnerComponent,
      template: 'inner'
    });

    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: `{{inner-component submit=(action 'outerAction' value="readProp")}}`
    });

    this.render('{{outer-component}}');

    this.runTask(() => {
      innerComponent.fireAction();
    });

    this.assert.equal(actualValue, newValue, 'value is read');
  }

  ['@test action will read the value of a first property']() {
    let newValue = 'irate igor';

    let innerComponent;
    let actualValue;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        innerComponent = this;
      },
      fireAction() {
        this.attrs.submit({
          readProp: newValue
        });
      }
    });

    let OuterComponent = Component.extend({
      outerAction(incomingValue) {
        actualValue = incomingValue;
      }
    });

    this.registerComponent('inner-component', {
      ComponentClass: InnerComponent,
      template: 'inner'
    });

    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: `{{inner-component submit=(action outerAction value="readProp")}}`
    });

    this.render('{{outer-component}}');

    this.runTask(() => {
      innerComponent.fireAction();
    });

    this.assert.equal(actualValue, newValue, 'property is read');
  }

  ['@test action will read the value of a curried first argument property']() {
    let newValue = 'kissing kris';

    let innerComponent;
    let actualValue;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        innerComponent = this;
      },
      fireAction() {
        this.attrs.submit();
      }
    });

    let OuterComponent = Component.extend({
      objectArgument: {
        readProp: newValue
      },
      outerAction(incomingValue) {
        actualValue = incomingValue;
      }
    });

    this.registerComponent('inner-component', {
      ComponentClass: InnerComponent,
      template: 'inner'
    });

    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: `{{inner-component submit=(action outerAction objectArgument value="readProp")}}`
    });

    this.render('{{outer-component}}');

    this.runTask(() => {
      innerComponent.fireAction();
    });

    this.assert.equal(actualValue, newValue, 'property is read');
  }

  ['@test action closure does not get auto-mut wrapped']() {
    let first = 'raging robert';
    let second = 'mild machty';
    let returnValue = 'butch brian';

    let innerComponent;
    let actualFirst;
    let actualSecond;
    let actualReturnedValue;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        innerComponent = this;
      },
      fireAction() {
        actualReturnedValue = this.attrs.submit(second);
      }
    });

    let MiddleComponent = Component.extend({
    });

    let OuterComponent = Component.extend({
      actions: {
        outerAction(incomingFirst, incomingSecond) {
          actualFirst = incomingFirst;
          actualSecond = incomingSecond;
          return returnValue;
        }
      }
    });

    this.registerComponent('inner-component', {
      ComponentClass: InnerComponent,
      template: 'inner'
    });

    this.registerComponent('middle-component', {
      ComponentClass: MiddleComponent,
      template: `{{inner-component submit=attrs.submit}}`
    });

    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: `{{middle-component submit=(action 'outerAction' '${first}')}}`
    });

    this.render('{{outer-component}}');

    this.runTask(() => {
      innerComponent.fireAction();
    });

    this.assert.equal(actualFirst, first, 'first argument is correct');
    this.assert.equal(actualSecond, second, 'second argument is correct');
    this.assert.equal(actualReturnedValue, returnValue, 'return value is present');
  }

  ['@test action should be called within a run loop']() {
    let innerComponent;
    let capturedRunLoop;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        innerComponent = this;
      },
      fireAction() {
        this.attrs.submit();
      }
    });

    let OuterComponent = Component.extend({
      actions: {
        submit() {
          capturedRunLoop = run.currentRunLoop;
        }
      }
    });

    this.registerComponent('inner-component', {
      ComponentClass: InnerComponent,
      template: 'inner'
    });

    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: `{{inner-component submit=(action 'submit')}}`
    });

    this.render('{{outer-component}}');

    this.runTask(() => {
      innerComponent.fireAction();
    });

    this.assert.ok(capturedRunLoop, 'action is called within a run loop');
  }

  ['@test objects that define INVOKE can be casted to actions']() {
    let innerComponent;
    let actionArgs;
    let invokableArgs;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        innerComponent = this;
      },
      fireAction() {
        actionArgs = this.attrs.submit(4, 5, 6);
      }
    });

    let OuterComponent = Component.extend({
      foo: 123,
      submitTask: computed(function() {
        return {
          [INVOKE]: (...args) => {
            invokableArgs = args;
            return this.foo;
          }
        };
      })
    });

    this.registerComponent('inner-component', {
      ComponentClass: InnerComponent,
      template: 'inner'
    });

    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: `{{inner-component submit=(action submitTask 1 2 3)}}`
    });

    this.render('{{outer-component}}');

    this.runTask(() => {
      innerComponent.fireAction();
    });

    this.assert.equal(actionArgs, 123);
    this.assert.deepEqual(invokableArgs, [1, 2, 3, 4, 5, 6]);
  }

  ['@test closure action with `(mut undefinedThing)` works properly [GH#13959]']() {
    let component;

    let ExampleComponent = Component.extend({
      label: undefined,
      init() {
        this._super(...arguments);
        component = this;
      }
    });

    this.registerComponent('example-component', {
      ComponentClass: ExampleComponent,
      template: '<button onclick={{action (mut label) "Clicked!"}}>{{if label label "Click me"}}</button>'
    });

    this.render('{{example-component}}');

    this.assertText('Click me');

    this.assertStableRerender();

    this.runTask(() => {
      this.$('button').click();
    });

    this.assertText('Clicked!');

    this.runTask(() => {
      component.set('label', 'Dun clicked');
    });

    this.assertText('Dun clicked');

    this.runTask(() => {
      this.$('button').click();
    });

    this.assertText('Clicked!');

    this.runTask(() => {
      component.set('label', undefined);
    });

    this.assertText('Click me');
  }
});

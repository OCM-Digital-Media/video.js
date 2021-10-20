/**
 * @file loading-spinner.js
 */
import Component from './component';
import * as dom from './utils/dom';

/**
 * A loading spinner for use during waiting/loading events.
 *
 * @extends Component
 */
class LoadingSpinner extends Component {

  /**
   * Create the `LoadingSpinner`s DOM element.
   *
   * @return {Element}
   *         The dom element that gets created.
   */
  createEl() {
    const isAudio = this.player_.isAudio();
    const playerType = this.localize(isAudio ? 'Audio Player' : 'Video Player');
    const controlText = dom.createEl('span', {
      className: 'ovp-control-text',
      textContent: this.localize('{1} is loading.', [playerType])
    });

    const el = super.createEl('div', {
      className: 'ovp-loading-spinner',
      dir: 'ltr'
    });

    el.appendChild(controlText);

    return el;
  }
}

Component.registerComponent('LoadingSpinner', LoadingSpinner);
export default LoadingSpinner;

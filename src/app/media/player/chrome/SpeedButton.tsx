import { h, Component, render } from "preact";
import { IPlayerApi, SpeedChangeEvent } from "../IPlayerApi";
import { EventHandler } from "../../../libs/events/EventHandler";

export interface ISpeedButtonProps {
  api: IPlayerApi;
  onHover?: () => void;
  onEndHover?: () => void;
}

export class SpeedButton extends Component<ISpeedButtonProps, {}> {
  private _handler: EventHandler = new EventHandler(this);
  
  private _speedElement: HTMLElement;

  private _state: number = 1.0;

  private _mouseover: boolean = false;

  private _onClick(): void {
    const api = this.props.api;
    api.setSpeed(1);
  }

  private _onSpeedData(speed: number): void {
    this._setState(speed);
    if (this._mouseover) {
      this._onMouseOver();
    }
  }

  private _onSpeedChange(e: SpeedChangeEvent): void {
    this._onSpeedData(e.speed);
  }

  private _setState(state: number): void {
    if (this._state === state) return;
    this._state = state;
    this._speedElement.textContent = state.toFixed(2) + 'x';
  }

  private _onMouseOver() {
    this._mouseover = true;
    if (this.props.onHover) {
      this.props.onHover();
    }
  }
  
  private _onMouseOut() {
    this._mouseover = false;
    if (this.props.onEndHover) {
      this.props.onEndHover();
    }
  }

  componentDidMount() {
    this._handler
      .listen(this.base, 'mouseover', this._onMouseOver, { passive: true })
      .listen(this.base, 'mouseout', this._onMouseOut, { passive: true })
      .listen(this.props.api, 'speedchange', this._onSpeedChange, false);
    
    this._onSpeedData(this.props.api.getSpeed());
  }

  componentWillUnmount() {
    this._handler.removeAll();
  }

  render(): JSX.Element {
    const onClick = () => this._onClick();
    const speedRef = (el: HTMLElement) => this._speedElement = el;

    return (
      <button
        class="chrome-speed-button chrome-button"
        onClick={onClick}>
        <span class="chrome-speed" ref={speedRef}>1.00x</span>
      </button>
    );
  }
}
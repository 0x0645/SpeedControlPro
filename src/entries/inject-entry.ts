// Side-effect imports: each module registers its singleton on import.
// Order matters — dependencies must load before consumers.

// 1. Foundation
import '../utils/constants';
import '../utils/logger';
import '../utils/debug-helper';
import '../utils/dom-utils';

// 2. Storage and settings
import '../core/storage-manager';
import '../core/settings';
import '../core/state-manager';

// 3. UI components
import '../ui/controls';
import '../ui/drag-handler';
import '../ui/shadow-dom';
import '../ui/vsc-controller-element';

// 4. Site handlers
import '../site-handlers/base-handler';
import '../site-handlers/netflix-handler';
import '../site-handlers/youtube-handler';
import '../site-handlers/facebook-handler';
import '../site-handlers/amazon-handler';
import '../site-handlers/apple-handler';
import '../site-handlers/index';
import '../site-handlers/scripts/netflix';

// 5. Core runtime
import '../utils/event-manager';
import '../observers/media-observer';
import '../observers/mutation-observer';
import '../core/action-handler';
import '../core/video-controller';

// 6. Main entry — instantiates and runs everything
import '../content/inject';

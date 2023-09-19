import { Camera } from 'expo-camera';
import React, { useMemo } from 'react';

import { useActionSheet } from '../../../containers/ActionSheet';
import i18n from '../../../i18n';
import { getUserSelector } from '../../../selectors/login';
import { compareServerVersion, showErrorAlert } from '../../methods/helpers';
import log from '../../methods/helpers/log';
import { handleAndroidBltPermission } from '../../methods/videoConf';
import { Services } from '../../services';
import { useAppSelector } from '../useAppSelector';
import StartACallActionSheet from './StartACallActionSheet';
import { useVideoConfCall } from './useVideoConfCall';

const availabilityErrors = {
	NOT_CONFIGURED: 'video-conf-provider-not-configured',
	NOT_ACTIVE: 'no-active-video-conf-provider',
	NO_APP: 'no-videoconf-provider-app'
} as const;

const handleErrors = (isAdmin: boolean, error: keyof typeof availabilityErrors) => {
	const key = isAdmin ? `admin-${error}` : error;
	showErrorAlert(i18n.t(`${key}-body`), i18n.t(`${key}-header`));
};

export const useVideoConf = (
	rid: string
): { showInitCallActionSheet: () => Promise<void>; callEnabled: boolean; disabledTooltip?: boolean } => {
	const user = useAppSelector(state => getUserSelector(state));
	const serverVersion = useAppSelector(state => state.server.version);

	const { callEnabled, disabledTooltip } = useVideoConfCall(rid);

	const [permission, requestPermission] = Camera.useCameraPermissions();
	const { showActionSheet } = useActionSheet();

	const isServer5OrNewer = useMemo(() => compareServerVersion(serverVersion, 'greaterThanOrEqualTo', '5.0.0'), [serverVersion]);

	const canInitAnCall = async (): Promise<boolean> => {
		if (!callEnabled) return false;

		if (isServer5OrNewer) {
			try {
				await Services.videoConferenceGetCapabilities();
				return true;
			} catch (error: any) {
				const isAdmin = !!user.roles?.includes('admin');
				handleErrors(isAdmin, error?.error || 'NOT_CONFIGURED');
				return false;
			}
		}
		return true;
	};

	const showInitCallActionSheet = async () => {
		try {
			const canInit = await canInitAnCall();
			if (canInit) {
				showActionSheet({
					children: <StartACallActionSheet rid={rid} />,
					snaps: [480]
				});

				if (!permission?.granted) {
					requestPermission();
					handleAndroidBltPermission();
				}
			}
		} catch (error) {
			log(error);
		}
	};

	return { showInitCallActionSheet, callEnabled, disabledTooltip };
};

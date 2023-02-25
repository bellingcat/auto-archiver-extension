import OptionsSync from 'webext-options-sync';

export default new OptionsSync({
	defaults: {
		archivedUrls: {},
	},
	migrations: [
		OptionsSync.migrations.removeUnused,
	],
	logging: true,
});

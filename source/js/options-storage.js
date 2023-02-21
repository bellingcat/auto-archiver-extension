import OptionsSync from 'webext-options-sync';

export default new OptionsSync({
	defaults: {
		archived_urls: {},
	},
	migrations: [
		OptionsSync.migrations.removeUnused,
	],
	logging: true,
});
